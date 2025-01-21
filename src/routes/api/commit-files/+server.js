import { json } from '@sveltejs/kit';
import { Octokit } from '@octokit/rest';
import { list, del } from '@vercel/blob';
import { GITHUB_TOKEN } from '$env/static/private';

// Constants
const BATCH_SIZE = 3;

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

// Commit language files in batches
async function commitLanguageFiles(octokit, user, repoName, translations) {
	const languages = Object.keys(translations);

	for (let i = 0; i < languages.length; i += BATCH_SIZE) {
		const batch = languages.slice(i, i + BATCH_SIZE);

		// Process each batch sequentially
		for (const lang of batch) {
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

		// Small delay between batches
		if (i + BATCH_SIZE < languages.length) {
			await new Promise((resolve) => setTimeout(resolve, 1000));
		}
	}
}

export async function POST({ request }) {
	try {
		const { repoName, translations } = await request.json();
		console.log('Starting file commits for:', repoName);

		if (!GITHUB_TOKEN) {
			throw new Error('GitHub token not configured');
		}

		const octokit = new Octokit({ auth: GITHUB_TOKEN });
		const { data: user } = await octokit.users.getAuthenticated();

		// Commit translation files
		console.log('Committing translation files...');
		await commitLanguageFiles(octokit, user, repoName, translations);
		console.log('Translation files committed');

		// Clean up blob storage
		console.log('Cleaning up blob storage...');
		await cleanupBlobStorage();
		console.log('Blob storage cleaned up');

		// Only trigger deployment, don't wait for it
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
			message: 'Files committed successfully',
			status: 'success',
			repoUrl: `https://github.com/${user.login}/${repoName}`
		});
	} catch (error) {
		console.error('File commit error:', error);
		return json(
			{
				error: error.message || 'Failed to commit files',
				status: 'error',
				details: error.stack
			},
			{ status: error.status || 500 }
		);
	}
}
