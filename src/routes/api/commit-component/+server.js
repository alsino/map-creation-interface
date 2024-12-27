import { json } from '@sveltejs/kit';
import { Octokit } from '@octokit/rest';
import { GITHUB_TOKEN } from '$env/static/private';
import { readdir, readFile } from 'fs/promises';
import { join } from 'path';
import ignore from 'ignore';
import { execSync } from 'child_process';

async function getAllFiles(dir, ignoredFiles) {
	const files = new Map();

	// First ensure package-lock.json exists
	try {
		await readFile('package-lock.json', 'utf-8');
	} catch (error) {
		// If package-lock.json doesn't exist, create it by running npm install
		console.log('Generating package-lock.json...');
		execSync('npm install', { stdio: 'inherit' });
	}

	async function scan(directory) {
		const entries = await readdir(directory, { withFileTypes: true });

		for (const entry of entries) {
			const path = join(directory, entry.name);
			const relativePath = path.replace(process.cwd() + '/', '');

			// Skip .git directory and ignored files, but INCLUDE package-lock.json
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

export async function POST({ request }) {
	const { repoName } = await request.json();

	if (!GITHUB_TOKEN) {
		return json({ error: 'GitHub token not configured' }, { status: 500 });
	}

	try {
		// Read .gitignore
		const gitignoreContent = await readFile('.gitignore', 'utf-8');
		const ignoredFiles = ignore().add(gitignoreContent);

		// Get all project files
		const projectFiles = await getAllFiles(process.cwd(), ignoredFiles);

		const octokit = new Octokit({ auth: GITHUB_TOKEN });
		const { data: user } = await octokit.users.getAuthenticated();

		// Add vercel.json configuration
		const vercelConfig = {
			github: {
				enabled: true,
				silent: true
			},
			framework: 'sveltekit'
		};

		// Commit vercel.json first
		await octokit.repos.createOrUpdateFileContents({
			owner: user.login,
			repo: repoName,
			path: 'vercel.json',
			message: 'Add Vercel configuration',
			content: Buffer.from(JSON.stringify(vercelConfig, null, 2)).toString('base64')
		});

		// Commit each file
		for (const [path, content] of projectFiles) {
			try {
				await octokit.repos.createOrUpdateFileContents({
					owner: user.login,
					repo: repoName,
					path,
					message: `Add ${path}`,
					content: Buffer.from(content).toString('base64')
				});
			} catch (error) {
				console.error(`Error committing ${path}:`, error);
				throw new Error(`Failed to commit ${path}: ${error.message}`);
			}
		}

		return json({ message: 'Project files committed successfully' });
	} catch (error) {
		console.error('Error:', error);
		return json(
			{
				error: error.message || 'Failed to commit files',
				details: error.response?.data?.errors
			},
			{ status: 500 }
		);
	}
}
