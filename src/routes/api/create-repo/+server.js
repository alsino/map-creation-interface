import { json } from '@sveltejs/kit';
import { Octokit } from '@octokit/rest';
import { GITHUB_TOKEN } from '$env/static/private';

// In your API route (src/routes/api/create-repo/+server.js)
export async function POST({ request }) {
	const { repoName } = await request.json();

	if (!repoName) {
		return json({ error: 'Repository name is required' }, { status: 400 });
	}

	if (!GITHUB_TOKEN) {
		return json({ error: 'GitHub token not configured' }, { status: 500 });
	}

	const octokit = new Octokit({ auth: GITHUB_TOKEN });

	try {
		const { data } = await octokit.repos.createForAuthenticatedUser({
			name: repoName,
			private: false
		});

		return json({ message: 'Repository created', data });
	} catch (error) {
		console.error('Error:', error);

		// Check for specific error cases
		if (
			error.status === 422 &&
			error.response?.data?.errors?.[0]?.message === 'name already exists on this account'
		) {
			return json(
				{
					error: `A repository named '${repoName}' already exists in your account`
				},
				{ status: 422 }
			);
		}

		return json(
			{
				error: error.message || 'Failed to create repository',
				details: error.response?.data?.errors
			},
			{ status: 500 }
		);
	}
}
