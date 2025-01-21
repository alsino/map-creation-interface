import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { GITHUB_TOKEN, GITHUB_USERNAME } from '$env/static/private';
import { Octokit } from '@octokit/rest';
import { list, del } from '@vercel/blob';

// Constants
const REPO_CHECK_ATTEMPTS = 5;
const REPO_CHECK_DELAY = 2000;
const DEPLOYMENT_CHECK_ATTEMPTS = 10;
const DEPLOYMENT_CHECK_DELAY = 5000;

// Helper function to wait for repo with exponential backoff
async function waitForRepo(octokit, owner, repo, maxAttempts = REPO_CHECK_ATTEMPTS) {
	for (let i = 0; i < maxAttempts; i++) {
		try {
			console.log(`Attempt ${i + 1} to fetch repo...`);
			const { data } = await octokit.repos.get({ owner, repo });
			console.log('Repository found:', data.full_name);
			return data;
		} catch (error) {
			console.log(`Attempt ${i + 1} failed:`, error.message);
			if (i === maxAttempts - 1) {
				throw new Error(`Repository not found after ${maxAttempts} attempts`);
			}
			await new Promise((resolve) => setTimeout(resolve, REPO_CHECK_DELAY * Math.pow(2, i)));
		}
	}
}

// Helper to verify deployment status
async function checkDeploymentStatus(token, deploymentId, maxAttempts = DEPLOYMENT_CHECK_ATTEMPTS) {
	for (let i = 0; i < maxAttempts; i++) {
		const response = await fetch(`https://api.vercel.com/v13/deployments/${deploymentId}`, {
			headers: {
				Authorization: `Bearer ${token}`
			}
		});

		if (!response.ok) {
			throw new Error('Failed to check deployment status');
		}

		const data = await response.json();

		if (data.readyState === 'READY') {
			return data;
		} else if (data.readyState === 'ERROR') {
			throw new Error('Deployment failed: ' + (data.errorMessage || 'Unknown error'));
		}

		await new Promise((resolve) => setTimeout(resolve, DEPLOYMENT_CHECK_DELAY));
	}
	throw new Error('Deployment timeout');
}

// Helper to clean up blob storage
async function cleanupBlobStorage() {
	try {
		const { blobs } = await list();
		await Promise.all(
			blobs.map(async (blob) => {
				try {
					await del(blob.url);
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

// Get Vercel token with validation
function getVercelToken() {
	const token = env.DEPLOY_VERCEL_TOKEN || env.VERCEL_TOKEN;
	if (!token) {
		throw new Error('No Vercel token found');
	}
	return token;
}

export async function POST({ request }) {
	let deploymentStarted = false;

	try {
		// Validate environment variables
		const token = getVercelToken();
		if (!token || !GITHUB_TOKEN || !GITHUB_USERNAME) {
			throw new Error('Missing required environment variables');
		}

		// Validate request body
		const { repoName } = await request.json();
		if (!repoName) {
			throw new Error('Repository name is required');
		}

		console.log('Starting Vercel deployment process...');

		// Initialize Octokit and wait for repo
		const octokit = new Octokit({ auth: GITHUB_TOKEN });
		const repo = await waitForRepo(octokit, GITHUB_USERNAME, repoName);

		// Create Vercel project
		const projectResponse = await fetch('https://api.vercel.com/v9/projects', {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${token}`,
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
						key: 'DEPLOY_VERCEL_TOKEN',
						value: token,
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

		// Trigger deployment
		const deployResponse = await fetch('https://api.vercel.com/v13/deployments', {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${token}`,
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

		deploymentStarted = true;

		// Wait for deployment to be ready
		const finalDeployment = await checkDeploymentStatus(token, deployData.id);

		// Clean up blob storage after successful deployment
		await cleanupBlobStorage();

		return json({
			message: 'Deployment completed successfully',
			deploymentUrl: finalDeployment.url,
			projectUrl: `https://${finalDeployment.url}`
		});
	} catch (error) {
		console.error('Deployment error:', error);

		// If deployment was started but failed, still try to clean up blob storage
		if (deploymentStarted) {
			try {
				await cleanupBlobStorage();
			} catch (cleanupError) {
				console.error('Failed to cleanup blob storage after deployment error:', cleanupError);
			}
		}

		return json(
			{
				error: error.message || 'Failed to deploy',
				details: error.response?.data || error.stack
			},
			{ status: error.status || 500 }
		);
	}
}
