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
		const processedLanguages = new Set();

		try {
			// First initialize the repository
			updateSteps('create', ['validate']);
			const initData = await makeRequest('/api/init-repository', {
				repoName,
				mapConfig: $mapConfig
			});
			repoUrl = initData.repoUrl;

			// Then commit one language file at a time
			updateSteps('translations', ['validate', 'create']);
			const languages = Object.keys($translations);
			console.log(`Starting to process ${languages.length} languages:`, languages);

			for (let i = 0; i < languages.length; i++) {
				const lang = languages[i];
				const singleTranslation = {
					[lang]: $translations[lang]
				};

				try {
					await makeRequest('/api/commit-files', {
						repoName,
						translations: singleTranslation,
						isLastFile: i === languages.length - 1,
						currentIndex: i,
						totalFiles: languages.length
					});

					processedLanguages.add(lang);
					console.log(`Successfully processed language ${lang} (${i + 1}/${languages.length})`);

					// Update progress
					successMessage = `Processed ${i + 1} of ${languages.length} languages...`;
				} catch (error) {
					console.error(`Failed to process language ${lang}:`, error);
					// Wait a bit before retrying
					await new Promise((resolve) => setTimeout(resolve, 2000));
					// Retry this language
					i--;
					continue;
				}

				// Add a small delay between files
				if (i < languages.length - 1) {
					await new Promise((resolve) => setTimeout(resolve, 1000));
				}
			}

			// Verify all languages were processed
			const missingLanguages = languages.filter((lang) => !processedLanguages.has(lang));
			if (missingLanguages.length > 0) {
				console.error('Missing languages:', missingLanguages);
				throw new Error(
					`Failed to process ${missingLanguages.length} languages: ${missingLanguages.join(', ')}`
				);
			}

			// After all files are committed, clean up storage
			try {
				const cleanupResponse = await makeRequest('/api/cleanup-storage', {});
				if (cleanupResponse.remainingBlobs > 0) {
					console.warn(`${cleanupResponse.remainingBlobs} files remain in storage`);
				}
			} catch (cleanupError) {
				console.error('Storage cleanup failed:', cleanupError);
				// Continue with deployment even if cleanup fails
			}

			// Deploy to Vercel
			updateSteps('deploy', ['validate', 'create', 'translations', 'config']);
			const deployData = await makeRequest('/api/deploy-vercel', { repoName });

			deploymentUrl = deployData.projectUrl;
			embedUrl = deployData.projectUrl;
			updateSteps(null, ['validate', 'create', 'translations', 'config', 'deploy']);
			successMessage = 'Repository created and deployed successfully!';
		} catch (error) {
			console.error('Error:', error);
			if (processedLanguages.size > 0) {
				errorMessage = `${error.message}. Successfully processed languages: ${Array.from(processedLanguages).join(', ')}`;
			} else {
				errorMessage = error.message;
			}
			steps = steps.map((step) => ({
				...step,
				completed: false,
				current: false
			}));
		} finally {
			isLoading = false;
		}
	}

	// Helper function to handle request errors
	async function makeRequest(url, data) {
		const MAX_RETRIES = 3;
		let lastError;

		for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
			try {
				const response = await fetch(url, {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json'
					},
					body: JSON.stringify(data)
				});

				// Handle non-JSON responses
				const textData = await response.text();
				let jsonData;

				try {
					jsonData = JSON.parse(textData);
				} catch (parseError) {
					if (response.status === 504) {
						throw new Error('Request timeout - will retry');
					}
					throw new Error(textData || 'Invalid response format');
				}

				if (!response.ok) {
					throw new Error(jsonData.error || 'Request failed');
				}

				return jsonData;
			} catch (error) {
				console.error(`Attempt ${attempt + 1} failed:`, error);
				lastError = error;

				// If this isn't the last attempt, wait before retrying
				if (attempt < MAX_RETRIES - 1) {
					await new Promise((resolve) => setTimeout(resolve, 2000 * (attempt + 1)));
					continue;
				}
			}
		}

		throw lastError;
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
