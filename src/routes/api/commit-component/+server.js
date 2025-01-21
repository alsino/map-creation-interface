import { json } from '@sveltejs/kit';
import { Octokit } from '@octokit/rest';
import { put, del, list } from '@vercel/blob';
import { GITHUB_TOKEN } from '$env/static/private';

const MAX_RETRIES = 2;
const RETRY_DELAY = 1000;
const REPO_CREATION_WAIT = 2000;
const BATCH_SIZE = 5;

// Utility function to clean up blob storage
async function cleanupBlobStorage() {
	try {
		const { blobs } = await list();
		await Promise.all(
			blobs.map(async (blob) => {
				try {
					await del(blob.url);
				} catch (error) {
					console.error(`Failed to delete blob: ${blob.url}`, error);
				}
			})
		);
	} catch (error) {
		console.error('Error cleaning up blob storage:', error);
		throw error;
	}
}

// Modified to return both URLs and content map
async function saveTranslationsToBlob(translations) {
	try {
		const urlMap = {};
		const contentMap = {};
		const languages = Object.keys(translations);

		for (let i = 0; i < languages.length; i += BATCH_SIZE) {
			const batch = languages.slice(i, i + BATCH_SIZE);
			await Promise.all(
				batch.map(async (lang) => {
					try {
						const content = JSON.stringify(translations[lang]);
						const blob = await put(`languages/${lang}.json`, content, {
							contentType: 'application/json',
							access: 'public'
						});
						urlMap[lang] = blob.url;
						contentMap[lang] = content;
					} catch (error) {
						console.error(`Error saving translation for ${lang}:`, error);
						throw error;
					}
				})
			);
		}

		return { urlMap, contentMap };
	} catch (error) {
		console.error('Error in saveTranslationsToBlob:', error);
		throw error;
	}
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

// Create and configure repository
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

// Commit language files sequentially to ensure all files are processed
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
		} catch (error) {
			console.error(`Failed to commit language file ${lang}:`, error);
			// Optionally, you could choose to throw the error to stop processing
			// or continue with the next language file
		}
	}
}

export async function POST({ request }) {
	let blobStorageNeedsCleanup = false;

	try {
		const { repoName, mapConfig, translations } = await request.json();

		if (!GITHUB_TOKEN) {
			return json({ error: 'GitHub token not configured' }, { status: 500 });
		}

		// Validate repository name
		const repoNameRegex = /^[a-zA-Z0-9-_]+$/;
		if (!repoNameRegex.test(repoName)) {
			return json({ error: 'Invalid repository name' }, { status: 400 });
		}

		// Initialize Octokit
		const octokit = new Octokit({ auth: GITHUB_TOKEN });
		const { data: user } = await octokit.users.getAuthenticated();

		console.log(`Starting repository setup for: ${repoName}`);

		// Step 1: Save translations to blob storage and wait for completion
		let translationData = null;
		if (translations) {
			blobStorageNeedsCleanup = true;
			translationData = await saveTranslationsToBlob(translations);
		}

		// Step 2: Setup repository
		await setupRepository(octokit, user, repoName, mapConfig);
		console.log(`Repository setup complete for: ${repoName}`);

		// Step 3: Commit language files if translations exist
		if (translationData) {
			await commitLanguageFiles(octokit, user, repoName, translations);
			console.log(`Language files committed for: ${repoName}`);

			// Step 4: Clean up blob storage
			await cleanupBlobStorage();
			blobStorageNeedsCleanup = false;
		}

		// Step 5: Trigger deployment
		try {
			const deploymentController = new AbortController();
			const timeoutId = setTimeout(() => deploymentController.abort(), 30000);

			await retryOperation(async () => {
				try {
					await octokit.repos.createDispatchEvent({
						owner: user.login,
						repo: repoName,
						event_type: 'deployment',
						client_payload: {
							initiated_at: new Date().toISOString()
						}
					});
				} finally {
					clearTimeout(timeoutId);
				}
			}, 3);

			console.log(`Deployment triggered for: ${repoName}`);
		} catch (deploymentError) {
			console.error('Deployment trigger failure:', deploymentError);
			throw deploymentError;
		}

		return json({
			message: 'Repository created and configured successfully',
			status: 'success',
			repoUrl: `https://github.com/${user.login}/${repoName}`,
			translationUrls: translationData?.urlMap
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

		console.error('Critical error in repository setup:', error);
		return json(
			{
				error: error.message || 'Failed to create repository',
				status: 'error',
				details: {
					message: error.message,
					response: error.response?.data?.errors,
					stack: error.stack
				}
			},
			{ status: error.status || 500 }
		);
	}
}
