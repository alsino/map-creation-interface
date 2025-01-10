<script>
	import { page } from '$app/stores';
	import { onMount } from 'svelte';
	import ControlPanel from '$lib/components/ControlPanel.svelte';
	import MapPanel from '$lib/components/MapPanel.svelte';
	import DeployApp from '$lib/components/DeployApp.svelte';
	import { APP_HEIGHT_NEW } from '$lib/stores/shared';

	let containerRef;

	// Get the view parameter from the page store
	$: isFullscreen = $page.url.searchParams.get('view') === 'fullscreen';

	// Function to calculate and update height
	function updateHeight() {
		if (containerRef) {
			// Get the actual scroll height of the content
			const height = containerRef.scrollHeight;
			console.log('Calculated height:', height);
			$APP_HEIGHT_NEW = height;

			// Post message to parent
			window.parent.postMessage({ height }, '*');
		}
	}

	// Update height when content changes
	$: if (isFullscreen !== undefined) {
		// Use setTimeout to ensure DOM is updated
		setTimeout(updateHeight, 0);
	}

	onMount(() => {
		// Initial height calculation
		updateHeight();

		// Set up ResizeObserver for continuous monitoring
		const resizeObserver = new ResizeObserver(() => {
			updateHeight();
		});

		if (containerRef) {
			resizeObserver.observe(containerRef);
		}

		return () => {
			resizeObserver.disconnect();
		};
	});
</script>

<div bind:this={containerRef} class="flex {isFullscreen ? 'h-auto' : 'h-auto'}">
	{#if !isFullscreen}
		<div class="w-1/2 space-y-4 overflow-y-auto bg-gray-50 p-4">
			<ControlPanel />
			<DeployApp />
		</div>
	{/if}
	<MapPanel class={isFullscreen ? 'w-full' : 'w-1/2'} />
</div>
