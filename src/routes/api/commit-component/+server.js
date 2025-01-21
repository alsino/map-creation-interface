import { json } from '@sveltejs/kit';
import { Octokit } from '@octokit/rest';
import { put, del, list } from '@vercel/blob';
import { GITHUB_TOKEN } from '$env/static/private';

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
		} catch (error) {
			console.error(`Error saving translation for ${lang}:`, error);
			throw error;
		}
	}
	return urlMap;
}

export async function POST({ request }) {
	let blobStorageNeedsCleanup = false;

	try {
		const { repoName, mapConfig, translations } = await request.json();

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
		}

		// Step 2: Create and setup repository
		console.log('Setting up repository...');
		await setupRepository(octokit, user, repoName, mapConfig);

		// Step 3: Commit translation files
		if (translations) {
			console.log('Committing translation files...');
			await commitLanguageFiles(octokit, user, repoName, translations);

			// Step 4: Clean up blob storage immediately after commit
			console.log('Cleaning up blob storage...');
			await cleanupBlobStorage();
			blobStorageNeedsCleanup = false;
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
