<script>
	import { page } from '$app/stores';
	import ControlPanel from '$lib/components/ControlPanel.svelte';
	import MapPanel from '$lib/components/MapPanel.svelte';
	import DeployApp from '$lib/components/DeployApp.svelte';
	import { APP_HEIGHT_NEW } from '$lib/stores/shared';

	// Get the view parameter from the page store
	$: isFullscreen = $page.url.searchParams.get('view') === 'fullscreen';

	$: {
		if ($APP_HEIGHT_NEW) {
			console.log('$APP_HEIGHT_NEW', $APP_HEIGHT_NEW);
			window.parent.postMessage({ height: $APP_HEIGHT_NEW }, '*');
		}
	}
</script>

<div class="flex h-screen" bind:clientHeight={$APP_HEIGHT_NEW}>
	{#if !isFullscreen}
		<div class="w-1/2 space-y-4 overflow-y-auto bg-gray-50 p-4">
			<ControlPanel />
			<DeployApp />
		</div>
	{/if}
	<MapPanel class={isFullscreen ? 'w-full' : 'w-1/2'} />
</div>
