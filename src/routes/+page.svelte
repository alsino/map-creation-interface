<script>
	import { page } from '$app/stores';
	import { onMount } from 'svelte';
	import ControlPanel from '$lib/components/ControlPanel.svelte';
	import MapPanel from '$lib/components/MapPanel.svelte';
	import DeployApp from '$lib/components/DeployApp.svelte';
	import { APP_HEIGHT_NEW } from '$lib/stores/shared';

	let containerRef;
	let contentHeight = 0;

	// Get the view parameter from the page store
	$: isFullscreen = $page.url.searchParams.get('view') === 'fullscreen';

	function calculateTotalHeight() {
		if (containerRef) {
			// Get the maximum of different height measurements
			const calculatedHeight = Math.max(
				containerRef.scrollHeight,
				containerRef.offsetHeight,
				containerRef.clientHeight
			);

			// Add some buffer to prevent cutting off
			const heightWithBuffer = calculatedHeight + 50; // 50px buffer

			console.log('Height measurements:', {
				scrollHeight: containerRef.scrollHeight,
				offsetHeight: containerRef.offsetHeight,
				clientHeight: containerRef.clientHeight,
				finalHeight: heightWithBuffer
			});

			$APP_HEIGHT_NEW = heightWithBuffer;
			window.parent.postMessage({ height: heightWithBuffer }, '*');
		}
	}

	onMount(() => {
		// Initial calculation after a brief delay to ensure content is loaded
		setTimeout(calculateTotalHeight, 100);

		// Set up ResizeObserver for dynamic content changes
		const observer = new ResizeObserver(() => {
			calculateTotalHeight();
		});

		if (containerRef) {
			observer.observe(containerRef);

			// Also observe any dynamically loaded content
			const contentElements = containerRef.querySelectorAll('*');
			contentElements.forEach((element) => {
				observer.observe(element);
			});
		}

		return () => observer.disconnect();
	});

	// Watch for content changes that might affect height
	$: if (isFullscreen !== undefined) {
		setTimeout(calculateTotalHeight, 0);
	}
</script>

<div bind:this={containerRef} class="flex h-auto min-h-screen w-full">
	{#if !isFullscreen}
		<div class="w-1/2 space-y-4 overflow-y-auto bg-gray-50 p-4">
			<ControlPanel />
			<DeployApp />
		</div>
	{/if}
	<MapPanel class={isFullscreen ? 'w-full' : 'w-1/2'} />
</div>
