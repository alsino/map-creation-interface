<script>
	import { mapConfig } from '$lib/stores/config-map';
	import { translations } from '$lib/stores/translations';

	let repoName = '';
	let errorMessage = null;
	let successMessage = null;
	let isLoading = false;
	let repoUrl = null;
	let deploymentUrl = null;
	let embedUrl = null;

	// Function to convert string to slug
	function toSlug(str) {
		return str
			.toLowerCase()
			.trim()
			.replace(/[^\w\s-]/g, '')
			.replace(/[\s_]+/g, '-')
			.replace(/^-+|-+$/g, '');
	}

	function getEmbedCode(mapId, deployUrl, embedUrl) {
		const slugifiedId = toSlug(mapId);
		return `<iframe title="New Map" aria-label="Map" id="${slugifiedId}" src="${deployUrl}" scrolling="no" frameborder="0" style="width: 0; min-width: 100% !important; border: none;" height="624"></iframe><script type="text/javascript">window.addEventListener("message",e=>{if("${embedUrl}"!==e.origin)return;let t=e.data;if(t.height){document.getElementById("${slugifiedId}").height=t.height+"px"}},!1)<\/script>`;
	}

	let steps = [
		{ id: 'validate', text: 'Validating repository name', completed: false, current: false },
		{ id: 'translations', text: 'Saving translations', completed: false, current: false },
		{ id: 'create', text: 'Creating GitHub repository', completed: false, current: false },
		{ id: 'config', text: 'Configuring map settings', completed: false, current: false },
		{ id: 'deploy', text: 'Deploying to Vercel', completed: false, current: false }
	];

	function validateData(repoName, mapConfig, translations) {
		if (!repoName) throw new Error('Repository name is required');
		if (!mapConfig) throw new Error('Map configuration is required');

		// Ensure translations is an object if present
		if (translations && typeof translations !== 'object') {
			throw new Error('Invalid translations format');
		}

		// Validate repository name format
		if (!/^[a-zA-Z0-9-_]+$/.test(repoName)) {
			throw new Error(
				'Invalid repository name. Use only letters, numbers, hyphens, and underscores.'
			);
		}
	}

	function updateSteps(currentStep, completedSteps = []) {
		steps = steps.map((step) => ({
			...step,
			completed: completedSteps.includes(step.id),
			current: step.id === currentStep
		}));
	}

	// Add this to your handleSubmit function
	async function handleSubmit() {
		isLoading = true;
		errorMessage = null;
		successMessage = null;
		repoUrl = null;

		try {
			const controller = new AbortController();
			const timeoutId = setTimeout(() => controller.abort(), 120000); // 120 seconds timeout

			const response = await fetch('/api/commit-component', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Accept: 'application/json'
				},
				body: JSON.stringify({
					repoName,
					mapConfig: $mapConfig,
					translations: $translations
				}),
				signal: controller.signal
			});

			clearTimeout(timeoutId);

			if (!response.ok) {
				const text = await response.text();
				try {
					const data = JSON.parse(text);
					throw new Error(data.error || 'Failed to create repository');
				} catch (e) {
					throw new Error(`Server error: ${text}`);
				}
			}

			const data = await response.json();
			repoUrl = data.repoUrl;

			// Handle deployment
			try {
				const deployController = new AbortController();
				const deployTimeoutId = setTimeout(() => deployController.abort(), 15000);

				const deployResponse = await fetch('/api/deploy-vercel', {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json'
					},
					body: JSON.stringify({ repoName }),
					signal: deployController.signal
				});

				clearTimeout(deployTimeoutId);

				const deployData = await deployResponse.json();
				if (!deployResponse.ok) {
					throw new Error(deployData.error || 'Failed to deploy to Vercel');
				}

				deploymentUrl = `${deployData.projectUrl}?view=fullscreen`;
				embedUrl = `${deployData.projectUrl}`;

				// All steps completed
				steps = steps.map((step) => ({ ...step, completed: true, current: false }));
				successMessage = 'Successfully deployed!';
			} catch (deployError) {
				console.error('Deploy error:', deployError);
				successMessage =
					'Repository created, but deployment failed. You can deploy manually from the repository.';
				steps = steps.map((step) => ({
					...step,
					completed: step.id !== 'deploy',
					current: false
				}));
			}
		} catch (error) {
			console.error('Error:', error);
			errorMessage =
				error.name === 'AbortError'
					? 'Request timed out. The operation might still complete in the background.'
					: error.message;
			steps = steps.map((step) => ({ ...step, current: false }));
		} finally {
			isLoading = false;
		}
	}
</script>

<!-- Rest of your component template remains the same -->
<div class="rounded-lg bg-white p-6 text-left shadow-sm">
	<h3 class="mb-2 font-bold">Create Map</h3>
	<form on:submit|preventDefault={handleSubmit} class="space-y-4">
		<div>
			<label for="repoName" class="mb-2 block">Please enter a repository name below:</label>
			<input
				type="text"
				id="repoName"
				bind:value={repoName}
				disabled={isLoading}
				placeholder="e.g. employment-tertiary-attainment"
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

	{#if errorMessage}
		<div class="mt-4 rounded bg-red-50 p-4 text-red-700">
			<p class="font-bold">Error</p>
			<p>{errorMessage}</p>
		</div>
	{/if}

	{#if successMessage}
		<div class="mt-4 rounded bg-green-50 p-4 text-green-700">
			<p class="font-bold">Success</p>
			<p>{successMessage}</p>
			<div class="mt-2 space-y-2">
				{#if deploymentUrl}
					<p>
						Your map will soon be available at: <a
							href={deploymentUrl}
							target="_blank"
							rel="noopener noreferrer"
							class="underline">{deploymentUrl}</a
						>
					</p>
				{/if}

				{#if deploymentUrl}
					<div class="mt-4">
						<p class="mb-2 font-bold">Embed code:</p>
						<div class="relative">
							<pre class="overflow-x-auto rounded bg-gray-100 p-3 text-sm">{getEmbedCode(
									repoName,
									deploymentUrl,
									embedUrl
								)}</pre>
							<button
								class="absolute right-2 top-2 rounded bg-blue-500 px-2 py-1 text-xs text-white hover:bg-blue-600"
								on:click={() => {
									navigator.clipboard.writeText(getEmbedCode(repoName, deploymentUrl, embedUrl));
								}}
							>
								Copy
							</button>
						</div>
					</div>
				{/if}

				{#if repoUrl}
					<p>
						<a href={repoUrl} target="_blank" rel="noopener noreferrer" class="underline"
							>View map repository</a
						>
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
