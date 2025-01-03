<script>
	import { mapConfig } from '$lib/stores/config-map';
	let repoName = '';
	let errorMessage = null;
	let successMessage = null;
	let warningMessage = null;
	let isLoading = false;
	let repoUrl = null;
	let deploymentUrl = null;

	let steps = [
		{ id: 'validate', text: 'Validating repository name', completed: false, current: false },
		{ id: 'create', text: 'Creating GitHub repository', completed: false, current: false },
		{ id: 'config', text: 'Configuring map settings', completed: false, current: false },
		{ id: 'deploy', text: 'Deploying to Vercel', completed: false, current: false }
	];

	async function handleSubmit() {
		isLoading = true;
		errorMessage = null;
		successMessage = null;
		warningMessage = null;
		repoUrl = null;
		steps = steps.map((step) => ({ ...step, completed: false, current: false }));

		try {
			// Validation step
			steps = steps.map((step) => ({
				...step,
				current: step.id === 'validate'
			}));

			if (!/^[a-zA-Z0-9-_]+$/.test(repoName)) {
				throw new Error(
					'Invalid repository name. Use only letters, numbers, hyphens, and underscores.'
				);
			}

			// Create and config steps
			steps = steps.map((step) => ({
				...step,
				completed: step.id === 'validate',
				current: step.id === 'create'
			}));

			// Create and configure repository
			const response = await fetch('/api/commit-component', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ repoName, mapConfig: $mapConfig })
			});

			const data = await response.json();

			if (!response.ok) {
				throw new Error(data.error || 'Failed to create repository');
			}

			// Update steps for deployment
			steps = steps.map((step) => ({
				...step,
				completed: ['validate', 'create', 'config'].includes(step.id),
				current: step.id === 'deploy'
			}));

			// Deploy to Vercel using existing endpoint
			const deployResponse = await fetch('/api/deploy-vercel', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ repoName })
			});

			const deployData = await deployResponse.json();

			if (!deployResponse.ok) {
				throw new Error(deployData.error || 'Failed to deploy to Vercel');
			}

			// All steps completed
			steps = steps.map((step) => ({
				...step,
				completed: true,
				current: false
			}));

			successMessage = 'Successfully deployed!';
			deploymentUrl = deployData.projectUrl; // This is the permanent project URL from projectData.link
			repoUrl = data.repoUrl;

			// Add deployment URL to success message
			if (deployData.projectUrl) {
				successMessage += `\nProject URL: ${deployData.projectUrl}`;
			}
		} catch (error) {
			errorMessage = error.message;
			steps = steps.map((step) => ({
				...step,
				current: false
			}));
		} finally {
			isLoading = false;
		}
	}
</script>

<div class="rounded-lg bg-white p-6 text-left shadow-sm">
	<form on:submit|preventDefault={handleSubmit} class="space-y-4">
		<div>
			<label for="repoName" class="mb-2 block">Repository Name:</label>
			<input
				type="text"
				id="repoName"
				bind:value={repoName}
				disabled={isLoading}
				placeholder="Enter repository name"
				class="w-full rounded border p-2"
			/>
		</div>

		<button
			type="submit"
			disabled={isLoading}
			class="w-full min-w-[200px] rounded bg-blue-500 px-4 py-2 text-white hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-70"
		>
			{#if isLoading}
				<span class="spinner"></span>
			{:else}
				Create and Deploy Map
			{/if}
		</button>
	</form>

	{#if isLoading || steps.some((step) => step.completed)}
		<div class="mt-4 rounded bg-gray-50 p-4">
			{#each steps as step}
				<div class="step" class:completed={step.completed} class:current={step.current}>
					{#if step.completed}
						<span class="checkmark">✓</span>
					{:else if step.current}
						<span class="spinner small"></span>
					{:else}
						<span class="dot"></span>
					{/if}
					{step.text}
				</div>
			{/each}
		</div>
	{/if}

	{#if successMessage}
		<div class="mt-4 rounded bg-green-50 p-4 text-green-700">
			<p class="font-bold">Success</p>
			<p>Successfully deployed!</p>
			<div class="mt-2 space-y-2">
				{#if deploymentUrl}
					<p>
						Your map will be available in a few minutes at <a
							href={deploymentUrl}
							target="_blank"
							class="underline">{deploymentUrl}</a
						>
					</p>
				{/if}
				{#if repoUrl}
					<p>
						<a href={repoUrl} target="_blank" class="underline">View map repository</a>
					</p>
				{/if}
			</div>
		</div>
	{/if}
</div>

<style>
	.spinner {
		display: inline-block;
		width: 20px;
		height: 20px;
		border: 2px solid #ffffff;
		border-radius: 50%;
		border-top-color: transparent;
		animation: spin 0.8s linear infinite;
	}

	.spinner.small {
		width: 16px;
		height: 16px;
		border-width: 2px;
		border-color: #666;
		border-top-color: transparent;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	.step {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem 0;
		color: #666;
	}

	.step.completed {
		color: green;
	}

	.step.current {
		color: #0066cc;
		font-weight: bold;
	}

	.checkmark {
		color: green;
		font-weight: bold;
	}

	.dot {
		display: inline-block;
		width: 16px;
		height: 16px;
		border-radius: 50%;
		background-color: #ddd;
	}
</style>
