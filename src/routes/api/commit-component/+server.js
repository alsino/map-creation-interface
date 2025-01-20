import { json } from '@sveltejs/kit';
import { Octokit } from '@octokit/rest';
import { GITHUB_TOKEN } from '$env/static/private';

// Constants
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;
const REPO_CREATION_WAIT = 2000;

async function commitLanguageFile(octokit, user, repoName, lang, content, maxRetries = 3) {
	const path = `static/languages/${lang}.json`;

	for (let attempt = 1; attempt <= maxRetries; attempt++) {
		try {
			let sha;

			try {
				const { data: existingFile } = await octokit.repos.getContent({
					owner: user.login,
					repo: repoName,
					path
				});
				sha = existingFile.sha;
			} catch (error) {
				// File doesn't exist yet, which is fine
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

			return true;
		} catch (error) {
			if (error.status === 403 && error.response?.headers?.['x-ratelimit-remaining'] === '0') {
				const resetTime = error.response?.headers?.['x-ratelimit-reset'];
				if (resetTime) {
					const waitTime = parseInt(resetTime) * 1000 - Date.now() + 1000;
					if (waitTime > 0) {
						console.log(`Rate limit hit, waiting ${waitTime / 1000} seconds`);
						await new Promise((resolve) => setTimeout(resolve, waitTime));
					}
				}
			} else if (attempt < maxRetries) {
				// Wait longer between each retry
				await new Promise((resolve) => setTimeout(resolve, attempt * 2000));
				continue;
			}

			throw error;
		}
	}
}

async function commitLanguageFiles(octokit, user, repoName, translations) {
	const languages = Object.keys(translations);
	let processedCount = 0;
	const CHUNK_SIZE = 5;

	// Process languages in smaller chunks
	for (let i = 0; i < languages.length; i += CHUNK_SIZE) {
		const chunk = languages.slice(i, Math.min(i + CHUNK_SIZE, languages.length));

		// Process each language in the chunk
		for (const lang of chunk) {
			const content = JSON.stringify(translations[lang], null, 2);
			await commitLanguageFile(octokit, user, repoName, lang, content);
			processedCount++;
			console.log(`Successfully processed ${lang} (${processedCount}/${languages.length})`);

			// Small delay between files
			if (processedCount < languages.length) {
				await new Promise((resolve) => setTimeout(resolve, 500));
			}
		}

		// Larger delay between chunks
		if (i + CHUNK_SIZE < languages.length) {
			await new Promise((resolve) => setTimeout(resolve, 2000));
		}
	}

	return { processedCount, totalLanguages: languages.length };
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

export async function POST({ request }) {
	try {
		const { repoName, mapConfig, translationReferenceId } = await request.json();

		if (!GITHUB_TOKEN) {
			return json({ error: 'GitHub token not configured' }, { status: 500 });
		}

		// Validate repository name
		const repoNameRegex = /^[a-zA-Z0-9-_]+$/;
		if (!repoNameRegex.test(repoName)) {
			return json(
				{
					error: 'Invalid repository name',
					status: 'error'
				},
				{ status: 400 }
			);
		}

		// Initialize Octokit
		const octokit = new Octokit({ auth: GITHUB_TOKEN });
		const { data: user } = await octokit.users.getAuthenticated();

		// Setup repository
		await setupRepository(octokit, user, repoName, mapConfig);

		// If we have a translation reference, fetch and process translations
		if (translationReferenceId) {
			try {
				const response = await fetch(
					`${process.env.VERCEL_URL}/references/${translationReferenceId}.json`
				);
				if (!response.ok) {
					throw new Error('Failed to fetch translations reference');
				}
				const urlMap = await response.json();

				// Process each translation URL
				for (const [lang, url] of Object.entries(urlMap)) {
					const translationResponse = await fetch(url);
					if (!translationResponse.ok) {
						throw new Error(`Failed to fetch translation for ${lang}`);
					}
					const content = await translationResponse.json();
					await commitLanguageFile(octokit, user, repoName, lang, JSON.stringify(content));
				}
			} catch (error) {
				console.error('Error processing translations:', error);
				throw new Error('Failed to process translations: ' + error.message);
			}
		}

		// Trigger deployment
		await retryOperation(async () => {
			await octokit.repos.createDispatchEvent({
				owner: user.login,
				repo: repoName,
				event_type: 'deployment'
			});
		});

		return json({
			message: 'Repository created and configured successfully',
			status: 'success',
			repoUrl: `https://github.com/${user.login}/${repoName}`,
			languageStats
		});
	} catch (error) {
		console.error('Error:', error);
		return json(
			{
				error: error.message || 'Failed to create repository',
				status: 'error',
				details: error.response?.data?.errors
			},
			{ status: error.status || 500 }
		);
	}
}
