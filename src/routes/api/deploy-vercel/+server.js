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
			if (i === maxAttempts - 1)
				throw new Error(`Failed to find repository after ${maxAttempts} attempts`);
			await new Promise((resolve) => setTimeout(resolve, 2000));
		}
	}
}

export async function POST({ request }) {
	// Validate environment variables
	if (!VERCEL_TOKEN || !GITHUB_TOKEN || !GITHUB_USERNAME) {
		console.error('Missing environment variables');
		return json(
			{
				error: 'Missing required environment variables',
				details: 'Please check VERCEL_TOKEN, GITHUB_TOKEN, and GITHUB_USERNAME'
			},
			{ status: 500 }
		);
	}

	// Validate request body
	let repoName;
	try {
		const body = await request.json();
		repoName = body.repoName;
		if (!repoName) throw new Error('Repository name is required');
	} catch (error) {
		return json(
			{
				error: 'Invalid request body',
				details: error.message
			},
			{ status: 400 }
		);
	}

	try {
		console.log('Starting Vercel deployment process...');

		// Initialize Octokit and get repo
		const octokit = new Octokit({ auth: GITHUB_TOKEN });
		const repo = await waitForRepo(octokit, GITHUB_USERNAME, repoName);

		if (!repo || !repo.id) {
			throw new Error('Failed to get valid repository data');
		}

		// Create Vercel project
		const projectResponse = await fetch('https://api.vercel.com/v9/projects', {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${VERCEL_TOKEN}`,
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				name: repoName,
				framework: 'svelte',
				gitRepository: {
					type: 'github',
					repo: `${GITHUB_USERNAME}/${repoName}`,
					repoId: repo.id.toString()
				},
				buildCommand: 'npm run build',
				devCommand: 'npm run dev',
				outputDirectory: '.svelte-kit',
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
						key: 'DEPLOY_VERCEL_TOKEN', // Different name for deployed projects
						value: VERCEL_TOKEN, // But using our main token's value
						type: 'encrypted',
						target: ['production', 'preview', 'development']
					}
				]
			})
		});

		const projectData = await projectResponse.json();

		if (!projectResponse.ok || !projectData.id) {
			throw new Error(projectData.error?.message || 'Failed to create Vercel project');
		}

		// Get project domains
		let domainsData;
		try {
			const domainsResponse = await fetch(
				`https://api.vercel.com/v9/projects/${projectData.id}/domains`,
				{
					headers: {
						Authorization: `Bearer ${VERCEL_TOKEN}`,
						'Content-Type': 'application/json'
					}
				}
			);

			if (!domainsResponse.ok) {
				throw new Error('Failed to fetch domains');
			}

			domainsData = await domainsResponse.json();

			if (!domainsData.domains || domainsData.domains.length === 0) {
				throw new Error('No domains found for project');
			}
		} catch (error) {
			console.error('Domain fetch error:', error);
			// Continue with deployment even if domain fetch fails
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

		if (!deployResponse.ok || !deployData) {
			throw new Error(deployData?.error?.message || 'Failed to create deployment');
		}

		// Construct production URL only if we successfully got domain data
		const domainName = domainsData?.domains[0]?.name;
		const productionUrl = domainName ? `https://${domainName}` : null;

		return json({
			message: 'Project created and deployment initiated',
			deploymentUrl: deployData.url,
			projectUrl: productionUrl
		});
	} catch (error) {
		console.error('Deployment error:', error);
		return json(
			{
				error: error.message || 'Failed to deploy',
				details: error.response?.data || error.stack
			},
			{ status: error.status || 500 }
		);
	}
}
