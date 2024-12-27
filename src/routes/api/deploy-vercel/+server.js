import { json } from '@sveltejs/kit';
import { VERCEL_TOKEN, GITHUB_TOKEN, GITHUB_USERNAME } from '$env/static/private';
import { Octokit } from '@octokit/rest';

// Helper function to wait for repo to be available
async function waitForRepo(octokit, owner, repo, maxAttempts = 5) {
	for (let i = 0; i < maxAttempts; i++) {
		try {
			console.log(`Attempt ${i + 1} to fetch repo...`);
			const { data } = await octokit.repos.get({
				owner,
				repo
			});
			console.log('Repository found:', data.full_name);
			return data;
		} catch (error) {
			console.log(`Attempt ${i + 1} failed:`, error.message);
			if (i === maxAttempts - 1) throw error;
			// Wait 2 seconds between attempts
			await new Promise((resolve) => setTimeout(resolve, 2000));
		}
	}
}

export async function POST({ request }) {
	const { repoName } = await request.json();

	if (!VERCEL_TOKEN || !GITHUB_TOKEN || !GITHUB_USERNAME) {
		return json({ error: 'Missing required environment variables' }, { status: 500 });
	}

	try {
		console.log('Starting Vercel deployment process...');

		// Initialize Octokit
		const octokit = new Octokit({ auth: GITHUB_TOKEN });

		// Wait for repo to be available and get its ID
		const repo = await waitForRepo(octokit, GITHUB_USERNAME, repoName);
		if (!repo) {
			throw new Error('Failed to fetch repository');
		}

		// Create Vercel project with all required environment variables
		const projectResponse = await fetch('https://api.vercel.com/v9/projects', {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${VERCEL_TOKEN}`,
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				name: repoName,
				framework: 'svelte', // Change this from 'sveltekit' to 'svelte'
				gitRepository: {
					type: 'github',
					repo: `${GITHUB_USERNAME}/${repoName}`,
					repoId: repo.id.toString()
				},
				buildCommand: 'npm run build',
				devCommand: 'npm run dev',
				outputDirectory: '.svelte-kit', // This is important for SvelteKit projects
				environmentVariables: [
					{
						key: 'GITHUB_TOKEN',
						value: GITHUB_TOKEN,
						type: 'encrypted',
						target: ['production', 'preview', 'development']
					},
					{
						key: 'GITHUB_USERNAME',
						value: GITHUB_USERNAME,
						type: 'plain',
						target: ['production', 'preview', 'development']
					},
					{
						key: 'VERCEL_TOKEN',
						value: VERCEL_TOKEN,
						type: 'encrypted',
						target: ['production', 'preview', 'development']
					}
				]
			})
		});

		const projectData = await projectResponse.json();
		console.log('Project creation response:', projectData);

		if (!projectResponse.ok) {
			throw new Error(projectData.error?.message || 'Failed to create Vercel project');
		}

		// Create deployment
		const deployResponse = await fetch('https://api.vercel.com/v13/deployments', {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${VERCEL_TOKEN}`,
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				name: repoName,
				project: projectData.id,
				gitSource: {
					type: 'github',
					repo: `${GITHUB_USERNAME}/${repoName}`,
					ref: 'main',
					repoId: repo.id.toString()
				}
			})
		});

		const deployData = await deployResponse.json();
		console.log('Deployment response:', deployData);

		if (!deployResponse.ok) {
			throw new Error(deployData.error?.message || 'Failed to create deployment');
		}

		return json({
			message: 'Project created and deployment initiated',
			projectUrl: projectData.link,
			deploymentUrl: deployData.url
		});
	} catch (error) {
		console.error('Error:', error);
		return json(
			{
				error: error.message || 'Failed to deploy',
				details: error.response?.data
			},
			{ status: 500 }
		);
	}
}
