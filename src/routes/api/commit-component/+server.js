import { json } from '@sveltejs/kit';
import { Octokit } from '@octokit/rest';
import { GITHUB_TOKEN } from '$env/static/private';
import { put, get } from '@vercel/blob';

// Constants
const MAX_RETRIES = 3;
const RETRY_DELAY = 2000;
const REPO_CREATION_WAIT = 5000;
const TEMPLATE_OWNER = 'alsino';
const TEMPLATE_REPO = 'map-creation-interface';

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

// Save translations to blob storage and return URLs
async function saveTranslationsToBlob(translations) {
	try {
		const urlMap = {};

		for (const [lang, content] of Object.entries(translations)) {
			try {
				const contentString = JSON.stringify(content);
				console.log(
					`Saving translation for ${lang}, content:`,
					contentString.slice(0, 100) + '...'
				);

				const blob = await put(`languages/${lang}.json`, contentString, {
					contentType: 'application/json',
					access: 'public'
				});
				urlMap[lang] = blob.url;
			} catch (error) {
				console.error(`Error saving translation for ${lang}:`, error);
				throw new Error(`Failed to save translation for ${lang}: ${error.message}`);
			}
		}

		console.log('Saving URL map:', urlMap);
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

// Get translations from blob storage
async function getTranslationsFromBlob() {
	try {
		console.log('Fetching URL map from blob storage...');
		const urlMapResponse = await get('languages/url-map.json');
		if (!urlMapResponse) {
			console.log('No URL map found in blob storage');
			return null;
		}

		const urlMapText = await urlMapResponse.text();
		console.log('URL map text:', urlMapText);
		const urlMap = JSON.parse(urlMapText);
		console.log('Parsed URL map:', urlMap);

		const translations = {};

		for (const [lang, url] of Object.entries(urlMap)) {
			try {
				console.log(`Fetching translation for ${lang} from ${url}`);
				const response = await fetch(url);
				if (!response.ok) {
					throw new Error(`HTTP error! status: ${response.status}`);
				}
				const text = await response.text();
				console.log(`Raw response for ${lang}:`, text.slice(0, 100) + '...');
				translations[lang] = JSON.parse(text);
			} catch (error) {
				console.error(`Error fetching translation for ${lang}:`, error);
				throw error;
			}
		}

		return translations;
	} catch (error) {
		console.error('Error in getTranslationsFromBlob:', error);
		throw error;
	}
}

// Handle language files directly in GitHub
async function commitLanguageFiles(octokit, user, repoName, mapConfig, translations) {
	// Prepare language files in memory
	const languageFiles = new Map();

	// Add English translation
	if (mapConfig.translate) {
		languageFiles.set('static/languages/en.json', JSON.stringify(mapConfig.translate, null, 2));
	}

	// Add other translations
	if (translations) {
		for (const [lang, content] of Object.entries(translations)) {
			languageFiles.set(`static/languages/${lang}.json`, JSON.stringify(content, null, 2));
		}
	}

	// Commit each language file
	for (const [path, content] of languageFiles) {
		await retryOperation(async () => {
			let sha;
			try {
				const { data: existingFile } = await octokit.repos.getContent({
					owner: user.login,
					repo: repoName,
					path
				});
				sha = existingFile.sha;
			} catch (error) {
				// File doesn't exist yet, that's fine
			}

			await octokit.repos.createOrUpdateFileContents({
				owner: user.login,
				repo: repoName,
				path,
				message: `Add/update language file: ${path.split('/').pop()}`,
				content: Buffer.from(content).toString('base64'),
				sha,
				branch: 'main'
			});
		});
	}
}

export async function POST({ request }) {
	let requestBody;
	try {
		const text = await request.text();
		console.log('Request body:', text);
		requestBody = JSON.parse(text);
	} catch (error) {
		console.error('Error parsing request body:', error);
		return json(
			{
				error: 'Invalid JSON in request body',
				status: 'error',
				details: error.message
			},
			{ status: 400 }
		);
	}

	const { repoName, mapConfig, translations } = requestBody;

	// Validate inputs
	if (!GITHUB_TOKEN) {
		return json({ error: 'GitHub token not configured' }, { status: 500 });
	}

	const repoNameRegex = /^[a-zA-Z0-9-_]+$/;
	if (!repoNameRegex.test(repoName)) {
		return json(
			{
				error: 'Invalid repository name. Use only letters, numbers, hyphens, and underscores.',
				status: 'error'
			},
			{ status: 400 }
		);
	}

	const octokit = new Octokit({ auth: GITHUB_TOKEN });

	try {
		// 1. Save translations to blob storage
		let urlMap;
		if (translations) {
			urlMap = await saveTranslationsToBlob(translations);
			console.log('Translation URLs:', urlMap);
		}

		// 2. Get GitHub user
		const { data: user } = await octokit.users.getAuthenticated();

		// 3. Verify template repository
		await retryOperation(async () => {
			await octokit.repos.get({
				owner: TEMPLATE_OWNER,
				repo: TEMPLATE_REPO
			});
		});

		// 4. Handle existing repository
		try {
			await octokit.repos.delete({
				owner: user.login,
				repo: repoName
			});
			await new Promise((resolve) => setTimeout(resolve, 2000));
		} catch (error) {
			if (error.status !== 404) throw error;
		}

		// 5. Create new repository
		await retryOperation(async () => {
			await octokit.repos.createUsingTemplate({
				template_owner: TEMPLATE_OWNER,
				template_repo: TEMPLATE_REPO,
				owner: user.login,
				name: repoName,
				private: false,
				include_all_branches: false,
				description: 'Created from Euranet Plus Map template'
			});
		});

		await new Promise((resolve) => setTimeout(resolve, REPO_CREATION_WAIT));

		// 6. Update config-map.js
		const { data: currentFile } = await retryOperation(async () => {
			return await octokit.repos.getContent({
				owner: user.login,
				repo: repoName,
				path: 'src/lib/stores/config-map.js'
			});
		});

		const configMapContent = `import { writable } from 'svelte/store';

export const mapConfig = writable(${JSON.stringify(mapConfig, null, 2)});`;

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

		// 7. Handle language files
		await commitLanguageFiles(octokit, user, repoName, mapConfig, translations);

		// 8. Trigger Vercel deployment
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
			translationUrls: urlMap
		});
	} catch (error) {
		console.error('Error:', error);
		return json(
			{
				error: error.message || 'Failed to create repository',
				status: 'error',
				details: error.response?.data?.errors,
				action: 'Please try again or contact support if the issue persists'
			},
			{ status: error.status || 500 }
		);
	}
}
