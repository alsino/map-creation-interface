import { json } from '@sveltejs/kit';
import { Octokit } from '@octokit/rest';
import { GITHUB_TOKEN } from '$env/static/private';
import { readdir, readFile, writeFile, mkdir, unlink, rmdir } from 'fs/promises';
import { join } from 'path';
import ignore from 'ignore';
import { execSync } from 'child_process';

// Update these constants
const MAX_RETRIES = 5;
const RETRY_DELAY = 2000; // 2 seconds
const REPO_CREATION_WAIT = 5000; // 5 seconds

// Add the verification function
async function verifyRepositoryExists(octokit, owner, repo, maxAttempts = 5) {
	for (let i = 0; i < maxAttempts; i++) {
		try {
			await octokit.repos.get({
				owner,
				repo
			});
			return true; // Repository found
		} catch (error) {
			if (i === maxAttempts - 1) {
				throw new Error(`Failed to find repository after ${maxAttempts} attempts`);
			}
			// Wait before next attempt
			await new Promise((resolve) => setTimeout(resolve, 2000));
		}
	}
	return false;
}

async function getAllFiles(dir, ignoredFiles) {
	const files = new Map();

	// First ensure package-lock.json exists
	try {
		await readFile('package-lock.json', 'utf-8');
	} catch (error) {
		console.log('Generating package-lock.json...');
		execSync('npm install', { stdio: 'inherit' });
	}

	async function scan(directory) {
		const entries = await readdir(directory, { withFileTypes: true });

		for (const entry of entries) {
			const path = join(directory, entry.name);
			const relativePath = path.replace(process.cwd() + '/', '');

			if (
				relativePath.startsWith('.git/') ||
				(ignoredFiles.ignores(relativePath) && relativePath !== 'package-lock.json')
			)
				continue;

			if (entry.isDirectory()) {
				await scan(path);
			} else {
				const content = await readFile(path, 'utf-8');
				files.set(relativePath, content);
			}
		}
	}

	await scan(dir);
	return files;
}

async function saveLanguageFiles(translations) {
	try {
		const languagesDir = join(process.cwd(), 'static', 'languages');

		// Create languages directory if it doesn't exist
		await mkdir(languagesDir, { recursive: true });

		// Save each language file
		for (const [lang, content] of Object.entries(translations)) {
			const filePath = join(languagesDir, `${lang}.json`);
			await writeFile(filePath, JSON.stringify(content, null, 2), 'utf-8');
		}
	} catch (error) {
		console.error('Error saving language files:', error);
		throw new Error(`Failed to save language files: ${error.message}`);
	}
}

async function cleanupLanguageFiles() {
	try {
		const languagesDir = join(process.cwd(), 'static', 'languages');
		const entries = await readdir(languagesDir);

		// Delete all files in the directory
		for (const entry of entries) {
			await unlink(join(languagesDir, entry));
		}

		// Remove the directory itself
		await rmdir(languagesDir);
	} catch (error) {
		console.error('Failed to clean up language files:', error);
		// Don't throw, just log the error
	}
}

async function getLanguageFiles() {
	const languageFiles = new Map();
	const languagesDir = join(process.cwd(), 'static', 'languages');

	try {
		// Check if directory exists first
		await readdir(languagesDir);
	} catch (error) {
		if (error.code === 'ENOENT') {
			// Directory doesn't exist, return empty Map
			return languageFiles;
		}
		throw error;
	}

	try {
		const entries = await readdir(languagesDir, { withFileTypes: true });

		for (const entry of entries) {
			if (!entry.isDirectory()) {
				const path = join(languagesDir, entry.name);
				const content = await readFile(path, 'utf-8');
				languageFiles.set(`static/languages/${entry.name}`, content);
			}
		}
	} catch (error) {
		console.error('Error reading language files:', error);
		throw new Error(`Failed to read language files: ${error.message}`);
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
		// Save translations first if provided
		if (translations && Object.keys(translations).length > 0) {
			await saveLanguageFiles(translations);
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

			// Wait after deletion
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

		// Verify repository exists
		await verifyRepositoryExists(octokit, user.login, repoName);

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

			// Get language files and commit them
			const languageFiles = await getLanguageFiles();
			const failedFiles = [];

			for (const [path, content] of languageFiles) {
				try {
					await retryOperation(async () => {
						// First try to get existing file (if it exists)
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
					failedFiles.push(path);
				}
			}

			// Clean up temporary language files
			await cleanupLanguageFiles();

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
					failedFiles: failedFiles.length > 0 ? failedFiles : undefined,
					repoUrl: `https://github.com/${user.login}/${repoName}`
				});
			}

			return json({
				message: 'Repository created and configured successfully',
				status: 'success',
				warnings:
					failedFiles.length > 0
						? `Failed to commit some language files: ${failedFiles.join(', ')}`
						: undefined,
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
		// Try to clean up language files even if there was an error
		await cleanupLanguageFiles();

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
