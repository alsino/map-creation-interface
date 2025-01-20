import { json } from '@sveltejs/kit';
import { Octokit } from '@octokit/rest';
import { GITHUB_TOKEN } from '$env/static/private';
import { put } from '@vercel/blob';

// Constants
const MAX_RETRIES = 2;
const RETRY_DELAY = 1000;
const REPO_CREATION_WAIT = 2000;
const BATCH_SIZE = 5; // Process translations in batches

// Save translations to blob storage in batches
async function saveTranslationsToBlob(translations) {
	try {
		const urlMap = {};
		const languages = Object.keys(translations);

		// Process translations in batches
		for (let i = 0; i < languages.length; i += BATCH_SIZE) {
			const batch = languages.slice(i, i + BATCH_SIZE);
			await Promise.all(
				batch.map(async (lang) => {
					try {
						const blob = await put(`languages/${lang}.json`, JSON.stringify(translations[lang]), {
							contentType: 'application/json',
							access: 'public'
						});
						urlMap[lang] = blob.url;
					} catch (error) {
						console.error(`Error saving translation for ${lang}:`, error);
					}
				})
			);
		}

		// Save URL map
		await put('languages/url-map.json', JSON.stringify(urlMap), {
			contentType: 'application/json',
			access: 'public'
		});

		return urlMap;
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

// Commit language files with controlled parallel processing
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
	try {
		const { repoName, mapConfig, translations } = await request.json();

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

		// Improved logging for tracking
		console.log(`Starting repository setup for: ${repoName}`);

		// Step 1: Save translations to blob storage (don't wait)
		const translationPromise = translations
			? saveTranslationsToBlob(translations)
			: Promise.resolve(null);

		// Step 2: Setup repository
		await setupRepository(octokit, user, repoName, mapConfig);
		console.log(`Repository setup complete for: ${repoName}`);

		// Step 3: Commit language files (if any)
		if (translations) {
			await commitLanguageFiles(octokit, user, repoName, translations);
			console.log(`Language files committed for: ${repoName}`);
		}

		// Step 4: Get translation URLs (if applicable)
		const urlMap = await translationPromise;

		// Step 5: Trigger deployment with extended timeout and error handling
		try {
			// Increase timeout for deployment trigger
			const deploymentController = new AbortController();
			const timeoutId = setTimeout(() => deploymentController.abort(), 30000); // 30-second timeout

			await retryOperation(async () => {
				try {
					await octokit.repos.createDispatchEvent({
						owner: user.login,
						repo: repoName,
						event_type: 'deployment',
						// Optional: You can pass additional data if needed
						client_payload: {
							initiated_at: new Date().toISOString()
						}
					});
					clearTimeout(timeoutId);
				} catch (deployError) {
					clearTimeout(timeoutId);
					console.error('Deployment trigger failed:', deployError);
					throw deployError;
				}
			}, 3); // Increase retry attempts for deployment

			console.log(`Deployment triggered for: ${repoName}`);
		} catch (deploymentError) {
			console.error('Persistent deployment trigger failure:', deploymentError);
			return json(
				{
					error: 'Failed to trigger deployment',
					details: deploymentError.message,
					status: 'error'
				},
				{ status: 502 } // Use 502 Bad Gateway to indicate deployment issues
			);
		}

		return json({
			message: 'Repository created and configured successfully',
			status: 'success',
			repoUrl: `https://github.com/${user.login}/${repoName}`,
			translationUrls: urlMap
		});
	} catch (error) {
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
