<!-- src/routes/+page.svelte -->
<script>
	import ControlPanel from '$lib/components/ControlPanel.svelte';
	import MapPanel from '$lib/components/MapPanel.svelte';
	import DeployApp from '$lib/components/DeployApp.svelte';
</script>

<div class="flex h-screen">
	<div class="w-1/2 space-y-4 overflow-y-auto bg-gray-50 p-4">
		<ControlPanel />
		<DeployApp />
	</div>
	<MapPanel />
</div>
