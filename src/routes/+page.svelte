<script>
	import { page } from '$app/stores';
	import { onMount } from 'svelte';
	import ControlPanel from '$lib/components/ControlPanel.svelte';
	import MapPanel from '$lib/components/MapPanel.svelte';
	import DeployApp from '$lib/components/DeployApp.svelte';
	import { APP_HEIGHT_NEW } from '$lib/stores/shared';

	let containerRef;
	let lastHeight = 0; // Track last height to prevent infinite updates

	// Get the view parameter from the page store
	$: isFullscreen = $page.url.searchParams.get('view') === 'fullscreen';

	function calculateHeight() {
		if (containerRef) {
			const mapContainer = containerRef.querySelector('#euranet-map');
			const sourceNotes = containerRef.querySelector('#source-notes');

			const extraPadding = 40;
			const totalHeight = (mapContainer?.scrollHeight || 0) + extraPadding;

			// Only update if height has actually changed and is reasonable
			if (totalHeight !== lastHeight && totalHeight > 0 && totalHeight < 5000) {
				console.log('Height measurements:', {
					mapContainer: mapContainer?.scrollHeight,
					sourceNotes: sourceNotes?.offsetHeight,
					totalHeight: totalHeight
				});

				lastHeight = totalHeight;
				$APP_HEIGHT_NEW = totalHeight;
				window.parent.postMessage({ height: totalHeight }, '*');
			}
		}
	}

	onMount(() => {
		// Initial calculation
		setTimeout(calculateHeight, 500);

		// Debounced resize observer to prevent rapid updates
		let timeoutId;
		const observer = new ResizeObserver(() => {
			clearTimeout(timeoutId);
			timeoutId = setTimeout(calculateHeight, 100);
		});

		if (containerRef) {
			observer.observe(containerRef);
		}

		return () => {
			observer.disconnect();
			clearTimeout(timeoutId);
		};
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
