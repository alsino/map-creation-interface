<script>
	import { page } from '$app/stores';
	import ControlPanel from '$lib/components/ControlPanel.svelte';
	import MapPanel from '$lib/components/MapPanel.svelte';
	import DeployApp from '$lib/components/DeployApp.svelte';

	// Get the view parameter from the page store
	$: isFullscreen = $page.url.searchParams.get('view') === 'fullscreen';
</script>

<div class="flex h-screen">
	{#if !isFullscreen}
		<div class="w-1/2 space-y-4 overflow-y-auto bg-gray-50 p-4">
			<ControlPanel />
			<DeployApp />
		</div>
	{/if}
	<MapPanel class={isFullscreen ? 'w-full' : 'w-1/2'} />
</div>
