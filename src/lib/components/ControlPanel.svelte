<!-- src/lib/components/ControlPanel.svelte -->
<script>
	export let mapConfig;
</script>

<div class="space-y-4 rounded-lg bg-white p-6 text-left shadow-sm">
	<div class="space-y-2">
		<label for="title">Map Title</label>
		<input
			id="title"
			name="title"
			bind:value={mapConfig.title}
			placeholder="Enter map title"
			class="w-full rounded border p-2"
		/>
	</div>

	<div class="space-y-2">
		<label for="subtitle">Subtitle</label>
		<input
			id="subtitle"
			name="subtitle"
			bind:value={mapConfig.subtitle}
			placeholder="Enter subtitle"
			class="w-full rounded border p-2"
		/>
	</div>

	<div class="space-y-2">
		<label for="data">Data (CSV)</label>
		<textarea
			id="data"
			name="data"
			bind:value={mapConfig.data}
			class="h-32 w-full rounded border p-2"
			placeholder="Paste CSV data here"
		/>
	</div>

	<button class="w-full rounded bg-blue-500 px-4 py-2 text-white hover:bg-blue-600">
		Update Map
	</button>
</div>
