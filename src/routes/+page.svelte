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

	function calculateHeight() {
		if (containerRef) {
			// Get all the elements we need to measure
			const mapContainer = containerRef.querySelector('#euranet-map');
			const chartBody = containerRef.querySelector('#chart-body');
			const sourceNotes = containerRef.querySelector('#chart > div:last-child');

			// Add extra padding for the source notes
			const extraPadding = 40; // Adjust this value if needed

			const totalHeight = mapContainer?.scrollHeight || 0;

			console.log('Height measurements:', {
				mapContainer: mapContainer?.scrollHeight,
				chartBody: chartBody?.scrollHeight,
				sourceNotes: sourceNotes?.offsetHeight,
				totalHeight: totalHeight + extraPadding
			});

			const finalHeight = totalHeight + extraPadding;
			$APP_HEIGHT_NEW = finalHeight;
			window.parent.postMessage({ height: finalHeight }, '*');
		}
	}

	onMount(() => {
		// Initial delay to ensure content is loaded
		setTimeout(calculateHeight, 500);

		const observer = new ResizeObserver((entries) => {
			// Add a small delay to ensure content updates are complete
			setTimeout(calculateHeight, 100);
		});

		if (containerRef) {
			observer.observe(containerRef);

			// Observe map container specifically
			const mapContainer = containerRef.querySelector('#euranet-map');
			if (mapContainer) {
				observer.observe(mapContainer);
			}
		}

		// Also trigger recalculation when mapConfig changes
		return () => observer.disconnect();
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
