import { json } from '@sveltejs/kit';
import { Octokit } from '@octokit/rest';
import { GITHUB_TOKEN } from '$env/static/private';
import { readdir, readFile, writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import ignore from 'ignore';
import { execSync } from 'child_process';
import { saveTranslationsToBlob } from '$lib/utils/blobStorage';

// Add back the getLanguageFiles function
async function getLanguageFiles() {
	const languageFiles = new Map();
	const languagesDir = join(process.cwd(), 'static', 'languages');

	try {
		const entries = await readdir(languagesDir, { withFileTypes: true });

		for (const entry of entries) {
			if (!entry.isDirectory()) {
				const path = join(languagesDir, entry.name);
				const content = await readFile(path, 'utf-8');
				// Set the path relative to the repo root
				languageFiles.set(`static/languages/${entry.name}`, content);
			}
		}
	} catch (error) {
		console.error('Error reading language files:', error);
	}

	return languageFiles;
}

export async function POST({ request }) {
	const { repoName, mapConfig, translations } = await request.json();

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

	const MAX_RETRIES = 3;
	const RETRY_DELAY = 2000;
	const REPO_CREATION_WAIT = 5000;

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

	try {
		// Save translations to blob storage if in main app
		if (translations) {
			try {
				await saveTranslationsToBlob(translations);
			} catch (error) {
				console.error('Error saving to blob storage:', error);
				// Continue with repository creation even if blob storage fails
			}
		}

		const octokit = new Octokit({ auth: GITHUB_TOKEN });
		const { data: user } = await octokit.users.getAuthenticated();

		// Template repository check
		try {
			await octokit.repos.get({
				owner: 'alsino',
				repo: 'map-creation-interface'
			});
		} catch (error) {
			return json(
				{
					error: 'Template repository not found',
					status: 'error',
					details: 'Please ensure the template repository exists'
				},
				{ status: 404 }
			);
		}

		// Check and delete existing repo if needed
		try {
			await octokit.repos.get({
				owner: user.login,
				repo: repoName
			});

			await retryOperation(async () => {
				await octokit.repos.delete({
					owner: user.login,
					repo: repoName
				});
			});

			await new Promise((resolve) => setTimeout(resolve, 2000));
		} catch (error) {
			if (error.status !== 404) throw error;
		}

		// Create repository using template
		await retryOperation(async () => {
			await octokit.repos.createUsingTemplate({
				template_owner: 'alsino',
				template_repo: 'map-creation-interface',
				owner: user.login,
				name: repoName,
				private: false,
				include_all_branches: false,
				description: 'Created from Euranet Plus Map template'
			});
		});

		// Wait for repository to be ready
		await new Promise((resolve) => setTimeout(resolve, REPO_CREATION_WAIT));

		// Get and update config-map.js
		try {
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

			// For sub-apps, save translations to static files
			if (process.env.NODE_ENV !== 'production') {
				const languagesDir = join(process.cwd(), 'static', 'languages');
				await mkdir(languagesDir, { recursive: true });

				for (const [lang, content] of Object.entries(translations)) {
					const filePath = join(languagesDir, `${lang}.json`);
					await writeFile(filePath, JSON.stringify(content, null, 2), 'utf-8');
				}
			}

			// Get language files and commit them
			const languageFiles = await getLanguageFiles();

			for (const [path, content] of languageFiles) {
				try {
					await retryOperation(async () => {
						let sha;
						try {
							const { data: existingFile } = await octokit.repos.getContent({
								owner: user.login,
								repo: repoName,
								path: path
							});
							sha = existingFile.sha;
						} catch (error) {
							// File doesn't exist yet, that's okay
						}

						await octokit.repos.createOrUpdateFileContents({
							owner: user.login,
							repo: repoName,
							path: path,
							message: `Add language file: ${path}`,
							content: Buffer.from(content).toString('base64'),
							sha: sha,
							branch: 'main'
						});
					});
				} catch (error) {
					console.error(`Failed to commit language file ${path}:`, error);
				}
			}

			// Trigger Vercel deployment
			try {
				await retryOperation(async () => {
					await octokit.repos.createDispatchEvent({
						owner: user.login,
						repo: repoName,
						event_type: 'deployment'
					});
				});
			} catch (error) {
				return json({
					message: 'Repository created but deployment failed',
					status: 'warning',
					details: error.message,
					repoUrl: `https://github.com/${user.login}/${repoName}`
				});
			}

			return json({
				message: 'Repository created and configured successfully',
				status: 'success',
				repoUrl: `https://github.com/${user.login}/${repoName}`
			});
		} catch (error) {
			// If config update fails, delete the repository
			try {
				await octokit.repos.delete({
					owner: user.login,
					repo: repoName
				});
			} catch (deleteError) {
				console.error('Failed to clean up repository after error:', deleteError);
			}
			throw error;
		}
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
