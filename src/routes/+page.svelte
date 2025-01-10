<script>
	import { page } from '$app/stores';
	import { onMount } from 'svelte';
	import ControlPanel from '$lib/components/ControlPanel.svelte';
	import MapPanel from '$lib/components/MapPanel.svelte';
	import DeployApp from '$lib/components/DeployApp.svelte';
	import { APP_HEIGHT_NEW } from '$lib/stores/shared';

	let containerRef;
	let lastHeight = 0;

	// Get the view parameter from the page store
	$: isFullscreen = $page.url.searchParams.get('view') === 'fullscreen';

	function calculateHeight() {
		if (containerRef) {
			const sourceNotes = containerRef.querySelector('#source-notes');
			const sourceHeight = sourceNotes?.offsetHeight || 0;

			// Base height plus source notes height
			const totalHeight = 624 + sourceHeight;

			// Only update if height has changed
			if (totalHeight !== lastHeight) {
				console.log('Height measurements:', {
					baseHeight: 624,
					sourceHeight,
					totalHeight
				});

				lastHeight = totalHeight;
				$APP_HEIGHT_NEW = totalHeight;
				window.parent.postMessage({ height: totalHeight }, '*');
			}
		}
	}

	onMount(() => {
		// Single initial calculation after content loads
		setTimeout(calculateHeight, 500);
	});
</script>

<div bind:this={containerRef} class="flex w-full">
	{#if !isFullscreen}
		<div class="w-1/2 space-y-4 overflow-y-auto bg-gray-50 p-4">
			<ControlPanel />
			<DeployApp />
		</div>
	{/if}
	<MapPanel class={isFullscreen ? 'w-full' : 'w-1/2'} />
</div>
