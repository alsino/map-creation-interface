<script>
	import { page } from '$app/stores';
	import { onMount } from 'svelte';
	import ControlPanel from '$lib/components/ControlPanel.svelte';
	import MapPanel from '$lib/components/MapPanel.svelte';
	import DeployApp from '$lib/components/DeployApp.svelte';
	import { APP_HEIGHT_NEW } from '$lib/stores/shared';

	let containerRef;
	let lastHeight = 0;
	let isUpdating = false;

	// Get the view parameter from the page store
	$: isFullscreen = $page.url.searchParams.get('view') === 'fullscreen';

	function calculateHeight() {
		if (containerRef && !isUpdating) {
			isUpdating = true;

			const mapContainer = containerRef.querySelector('#euranet-map');
			const sourceNotes = containerRef.querySelector('#source-notes');

			const extraPadding = 40;
			const totalHeight = (mapContainer?.scrollHeight || 0) + extraPadding;

			// Only update if height has changed significantly (more than 5px)
			if (Math.abs(totalHeight - lastHeight) > 5 && totalHeight > 0 && totalHeight < 2000) {
				console.log('Height measurements:', {
					mapContainer: mapContainer?.scrollHeight,
					sourceNotes: sourceNotes?.offsetHeight,
					totalHeight: totalHeight
				});

				lastHeight = totalHeight;
				$APP_HEIGHT_NEW = totalHeight;
				window.parent.postMessage({ height: totalHeight }, '*');
			}

			// Reset the updating flag after a delay
			setTimeout(() => {
				isUpdating = false;
			}, 200);
		}
	}

	onMount(() => {
		// Initial calculation with a delay
		setTimeout(calculateHeight, 500);

		// Use a more restricted resize observer
		let debounceTimer;
		const observer = new ResizeObserver(() => {
			if (debounceTimer) clearTimeout(debounceTimer);
			debounceTimer = setTimeout(() => {
				if (!isUpdating) {
					calculateHeight();
				}
			}, 200);
		});

		if (containerRef) {
			observer.observe(containerRef);
		}

		return () => {
			observer.disconnect();
			if (debounceTimer) clearTimeout(debounceTimer);
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
