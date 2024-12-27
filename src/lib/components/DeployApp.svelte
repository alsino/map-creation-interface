<!-- src/lib/components/DeployApp.svelte -->
<script>
	let repoName = '';
	let errorMessage = null;
	let successMessage = null;
	let isLoading = false;
	let steps = [
		{ id: 'create', text: 'Creating GitHub repository', completed: false, current: false },
		{ id: 'commit', text: 'Committing project files', completed: false, current: false },
		{ id: 'deploy', text: 'Deploying to Vercel', completed: false, current: false }
	];

	async function handleSubmit() {
		isLoading = true;
		errorMessage = null;
		successMessage = null;
		steps = steps.map((step) => ({ ...step, completed: false, current: false }));

		try {
			steps = steps.map((step) => ({
				...step,
				current: step.id === 'create'
			}));

			const createResponse = await fetch('/api/create-repo', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ repoName })
			});

			if (!createResponse.ok) {
				const data = await createResponse.json();
				throw new Error(data.error || 'Failed to create repository');
			}

			steps = steps.map((step) => ({
				...step,
				completed: step.id === 'create',
				current: step.id === 'commit'
			}));

			const commitResponse = await fetch('/api/commit-component', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ repoName })
			});

			if (!commitResponse.ok) {
				throw new Error('Failed to commit files');
			}

			steps = steps.map((step) => ({
				...step,
				completed: ['create', 'commit'].includes(step.id),
				current: step.id === 'deploy'
			}));

			const deployResponse = await fetch('/api/deploy-vercel', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ repoName })
			});

			if (!deployResponse.ok) {
				const data = await deployResponse.json();
				throw new Error(data.error || 'Failed to deploy to Vercel');
			}

			const deployData = await deployResponse.json();

			steps = steps.map((step) => ({
				...step,
				completed: true,
				current: false
			}));

			successMessage = `Successfully deployed! Your site will be available at ${deployData.deploymentUrl}`;
			repoName = '';
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
				Create and Deploy Project
			{/if}
		</button>
	</form>

	{#if isLoading || steps.some((step) => step.completed)}
		<div class="steps-container">
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

	{#if errorMessage}
		<p class="error">{errorMessage}</p>
	{/if}

	{#if successMessage}
		<p class="success">{successMessage}</p>
	{/if}
</div>

<style>
	.error {
		color: red;
		margin-top: 1rem;
	}
	.success {
		color: green;
		margin-top: 1rem;
	}

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

	.steps-container {
		margin-top: 1.5rem;
		padding: 1rem;
		border-radius: 0.5rem;
		background-color: #f5f5f5;
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
