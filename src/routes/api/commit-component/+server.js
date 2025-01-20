import { json } from '@sveltejs/kit';
import { Octokit } from '@octokit/rest';
import { GITHUB_TOKEN } from '$env/static/private';

const MAX_RETRIES = 2;
const RETRY_DELAY = 1000;
const REPO_CREATION_WAIT = 2000;
const BATCH_SIZE = 10;

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

async function commitLanguageFiles(octokit, user, repoName, translations) {
	const languages = Object.keys(translations);
	let processedCount = 0;
	const failed = [];

	for (let i = 0; i < languages.length; i += BATCH_SIZE) {
		const batch = languages.slice(i, Math.min(i + BATCH_SIZE, languages.length));

		await Promise.all(
			batch.map(async (lang) => {
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
						// File doesn't exist yet
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
					processedCount++;
				} catch (error) {
					console.error(`Failed to commit ${lang}:`, error);
					failed.push(lang);
				}
			})
		);

		if (i + BATCH_SIZE < languages.length) {
			await new Promise((resolve) => setTimeout(resolve, 1000));
		}
	}

	return { processedCount, failed };
}

export async function POST({ request }) {
	try {
		const { repoName, mapConfig, translations } = await request.json();

		if (!GITHUB_TOKEN) {
			return json({ error: 'GitHub token not configured' }, { status: 500 });
		}

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

		const octokit = new Octokit({ auth: GITHUB_TOKEN });
		const { data: user } = await octokit.users.getAuthenticated();

		// Setup repository and update config
		await setupRepository(octokit, user, repoName, mapConfig);

		// Commit language files if provided
		let languageStats = null;
		if (translations) {
			languageStats = await commitLanguageFiles(octokit, user, repoName, translations);
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
