import { json } from '@sveltejs/kit';
import { Octokit } from '@octokit/rest';
import { put, del, list } from '@vercel/blob';
import { GITHUB_TOKEN } from '$env/static/private';

// Constants
const MAX_RETRIES = 2;
const RETRY_DELAY = 1000;
const REPO_CREATION_WAIT = 2000;

// Clean up blob storage
async function cleanupBlobStorage() {
	try {
		const { blobs } = await list();
		await Promise.all(
			blobs.map(async (blob) => {
				try {
					await del(blob.url);
					console.log(`Deleted blob: ${blob.url}`);
				} catch (error) {
					console.error(`Failed to delete blob: ${blob.url}`, error);
				}
			})
		);
		console.log('Blob storage cleanup completed');
	} catch (error) {
		console.error('Error cleaning up blob storage:', error);
		throw error;
	}
}

// Save translations to blob storage
async function saveTranslationsToBlob(translations) {
	const urlMap = {};
	const languages = Object.keys(translations);

	for (let i = 0; i < languages.length; i++) {
		const lang = languages[i];
		try {
			const blob = await put(`languages/${lang}.json`, JSON.stringify(translations[lang]), {
				contentType: 'application/json',
				access: 'public'
			});
			urlMap[lang] = blob.url;
			console.log(`Saved translation for ${lang}`);
		} catch (error) {
			console.error(`Error saving translation for ${lang}:`, error);
			throw error;
		}
	}
	return urlMap;
}

// Utility function for retrying operations
async function retryOperation(operation, retries = MAX_RETRIES) {
	for (let i = 0; i < retries; i++) {
		try {
			return await operation();
		} catch (error) {
			if (i === retries - 1) throw error;
			await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY));
		}
	}
}

// Setup repository function
async function setupRepository(octokit, user, repoName, mapConfig) {
	// Delete existing repo if needed
	try {
		await octokit.repos.delete({
			owner: user.login,
			repo: repoName
		});
		await new Promise((resolve) => setTimeout(resolve, 1000));
	} catch (error) {
		if (error.status !== 404) throw error;
	}

	// Create new repository
	await retryOperation(async () => {
		await octokit.repos.createUsingTemplate({
			template_owner: 'alsino',
			template_repo: 'map-creation-interface',
			owner: user.login,
			name: repoName,
			private: false,
			include_all_branches: false
		});
	});

	await new Promise((resolve) => setTimeout(resolve, REPO_CREATION_WAIT));

	// Update config-map.js
	const configMapContent = `import { writable } from 'svelte/store';
export const mapConfig = writable(${JSON.stringify(mapConfig, null, 2)});`;

	const { data: currentFile } = await retryOperation(async () => {
		return await octokit.repos.getContent({
			owner: user.login,
			repo: repoName,
			path: 'src/lib/stores/config-map.js'
		});
	});

	await retryOperation(async () => {
		await octokit.repos.createOrUpdateFileContents({
			owner: user.login,
			repo: repoName,
			path: 'src/lib/stores/config-map.js',
			message: 'Update map configuration',
			content: Buffer.from(configMapContent).toString('base64'),
			sha: currentFile.sha,
			branch: 'main'
		});
	});

	return true;
}

// Commit language files function
async function commitLanguageFiles(octokit, user, repoName, translations) {
	const languages = Object.keys(translations);

	for (const lang of languages) {
		try {
			const content = JSON.stringify(translations[lang], null, 2);
			const path = `static/languages/${lang}.json`;

			let sha;
			try {
				const { data: existingFile } = await octokit.repos.getContent({
					owner: user.login,
					repo: repoName,
					path
				});
				sha = existingFile.sha;
			} catch (error) {
				// File doesn't exist yet, no SHA needed
			}

			await octokit.repos.createOrUpdateFileContents({
				owner: user.login,
				repo: repoName,
				path,
				message: `Add language file: ${lang}`,
				content: Buffer.from(content).toString('base64'),
				sha,
				branch: 'main'
			});
			console.log(`Committed language file: ${lang}`);
		} catch (error) {
			console.error(`Failed to commit language file ${lang}:`, error);
			throw error;
		}
	}
}

// Main POST handler
export async function POST({ request }) {
	let blobStorageNeedsCleanup = false;

	try {
		const { repoName, mapConfig, translations } = await request.json();
		console.log('Starting process for repo:', repoName);

		if (!GITHUB_TOKEN) {
			throw new Error('GitHub token not configured');
		}

		const octokit = new Octokit({ auth: GITHUB_TOKEN });
		const { data: user } = await octokit.users.getAuthenticated();

		// Step 1: Save translations to blob
		let translationUrls = null;
		if (translations) {
			console.log('Saving translations to blob storage...');
			blobStorageNeedsCleanup = true;
			translationUrls = await saveTranslationsToBlob(translations);
			console.log('Translations saved to blob storage');
		}

		// Step 2: Create and setup repository
		console.log('Setting up repository...');
		await setupRepository(octokit, user, repoName, mapConfig);
		console.log('Repository setup completed');

		// Step 3: Commit translation files
		if (translations) {
			console.log('Committing translation files...');
			await commitLanguageFiles(octokit, user, repoName, translations);
			console.log('Translation files committed');

			// Step 4: Clean up blob storage immediately after commit
			console.log('Cleaning up blob storage...');
			await cleanupBlobStorage();
			blobStorageNeedsCleanup = false;
			console.log('Blob storage cleaned up');
		}

		// Step 5: Trigger deployment (don't wait for completion)
		console.log('Triggering deployment...');
		await octokit.repos.createDispatchEvent({
			owner: user.login,
			repo: repoName,
			event_type: 'deployment',
			client_payload: {
				initiated_at: new Date().toISOString()
			}
		});
		console.log('Deployment triggered');

		return json({
			message: 'Repository created and deployment initiated',
			status: 'success',
			repoUrl: `https://github.com/${user.login}/${repoName}`,
			projectUrl: `https://${repoName}.vercel.app` // Default Vercel URL
		});
	} catch (error) {
		// Ensure blob storage is cleaned up in case of errors
		if (blobStorageNeedsCleanup) {
			try {
				await cleanupBlobStorage();
				console.log('Blob storage cleaned up after error');
			} catch (cleanupError) {
				console.error('Failed to cleanup blob storage after error:', cleanupError);
			}
		}

		console.error('Error:', error);
		return json(
			{
				error: error.message || 'Failed to create repository',
				status: 'error'
			},
			{ status: error.status || 500 }
		);
	}
}
