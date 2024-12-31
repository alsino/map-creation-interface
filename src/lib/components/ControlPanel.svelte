<!-- src/lib/components/ControlPanel.svelte -->
<script>
	import { mapConfig } from '$lib/stores/config-map';
	import { dataReady } from '$lib/stores/shared';
	import { csvParse } from 'd3-dsv';

	// const colorSchemeTypes = ['sequential', 'diverging'];
	// const colorSchemes = {
	// 	sequential: ['blue', 'green', 'gray', 'orange', 'purple', 'red', 'blue-green', 'blue-purple'],
	// 	diverging: ['brown-blue-green', 'purple-green', 'red-blue', 'red-gray', 'red-yellow-blue']
	// };

	// Replace the current colorSchemes declaration with this:
	const colorSchemeTypes = ['sequential', 'diverging'];
	const colorSchemes = {
		sequential: [
			'blue',
			'green',
			'gray',
			'orange',
			'purple',
			'red',
			'blue-green',
			'blue-purple',
			'green-blue',
			'orange-red',
			'purple-blue-green',
			'purple-blue',
			'purple-blue-darker',
			'purple-red',
			'red-purple',
			'yellow-green-blue',
			'yellow-green',
			'yellow-orange-brown',
			'yellow-orange-red'
		],
		diverging: [
			'brown-blue-green',
			'purple-green',
			'pink-yellow-green',
			'purple-orange',
			'red-blue',
			'red-gray',
			'red-yellow-blue',
			'red-yellow-green',
			'spectral'
		]
	};

	let title = $mapConfig.title;
	let subtitle = $mapConfig.subtitle;
	let data = $mapConfig.data;
	let datasetType = $mapConfig.datasetType;
	let datasetUnit = $mapConfig.datasetUnit;
	let percentRounded = $mapConfig.percentRounded;
	let colourSchemeType = $mapConfig.colourSchemeType;
	let colourScheme = $mapConfig.colourScheme;
	let colourSchemeReverse = $mapConfig.colourSchemeReverse;
	let colourSchemeClasses = $mapConfig.colourSchemeClasses;
	let headlineAvailable = $mapConfig.headlineAvailable;
	let subheadlineAvailable = $mapConfig.subheadlineAvailable;
	let tooltipAvailable = $mapConfig.tooltipAvailable;
	let scaleBarAvailable = $mapConfig.scaleBarAvailable;
	let overrideScaleValues = $mapConfig.overrideScaleValues;
	let legendAvailable = $mapConfig.legendAvailable;
	let textSourceAvailable = $mapConfig.textSourceAvailable;
	let textSource = $mapConfig.textSource;
	let textNoteAvailable = $mapConfig.textNoteAvailable;
	let textNote = $mapConfig.textNote;
	let textDataAccessAvailable = $mapConfig.textDataAccessAvailable;
	let linkDataAccess = $mapConfig.linkDataAccess;
	let legend1Color = $mapConfig.legend1Color;
	let legend2Color = $mapConfig.legend2Color;
	let legend3Color = $mapConfig.legend3Color;
	let legend4Color = $mapConfig.legend4Color;
	let colorBarFirstValue = $mapConfig.colorBarFirstValue;
	let colorBarLastValue = $mapConfig.colorBarLastValue;
	let parsedData = $mapConfig.parsedData;

	$: mapConfig.set({
		title: title,
		subtitle: subtitle,
		colourSchemeClasses: colourSchemeClasses,
		data: data,
		parsedData: parsedData,
		datasetType: datasetType,
		datasetUnit: datasetUnit,
		percentRounded: percentRounded,
		colourSchemeType: colourSchemeType,
		colourScheme: colourScheme,
		colourSchemeReverse: colourSchemeReverse,
		colourSchemeClasses: colourSchemeClasses,
		headlineAvailable: headlineAvailable,
		subheadlineAvailable: subheadlineAvailable,
		tooltipAvailable: tooltipAvailable,
		scaleBarAvailable: scaleBarAvailable,
		overrideScaleValues: overrideScaleValues,
		legendAvailable: legendAvailable,
		textSourceAvailable: textSourceAvailable,
		textSource: textSource,
		textNoteAvailable: textNoteAvailable,
		textNote: textNote,
		textDataAccessAvailable: textDataAccessAvailable,
		linkDataAccess: linkDataAccess,
		legend1Color: legend1Color,
		legend2Color: legend2Color,
		legend3Color: legend3Color,
		legend4Color: legend4Color,
		colorBarFirstValue: colorBarFirstValue,
		colorBarLastValue: colorBarLastValue
	});

	$: data && handleCSVChange(data);

	function handleCSVChange(csvText) {
		const parsed = csvParse(csvText, (d) => ({
			...d,
			value: d.value === 'null' ? null : +d.value,
			extraInfo: d.extraInfo.toLowerCase() === 'true'
		}));

		mapConfig.update((m) => ({ ...m, parsedData: parsed }));
	}
</script>

<div class="space-y-4 rounded-lg bg-white p-6 text-left shadow-sm">
	<!-- Basic Settings -->
	<div class="space-y-2">
		<label for="title">Title</label>
		<input
			id="title"
			name="title"
			bind:value={title}
			placeholder="Enter map title"
			class="w-full rounded border p-2"
		/>
	</div>

	<div class="space-y-2">
		<label for="subtitle">Subtitle</label>
		<input
			id="subtitle"
			name="subtitle"
			bind:value={subtitle}
			placeholder="Enter subtitle"
			class="w-full rounded border p-2"
		/>
	</div>

	<div class="space-y-2">
		<label for="data">Data (CSV)</label>
		<!-- svelte-ignore element_invalid_self_closing_tag -->
		<textarea
			id="data"
			name="data"
			bind:value={data}
			class="h-32 w-full rounded border p-2"
			placeholder="Paste CSV data here"
		/>
	</div>

	<div class="space-y-2">
		<label for="source">Data Source</label>
		<input
			id="source"
			name="source"
			bind:value={textSource}
			placeholder="Name data source"
			class="w-full rounded border p-2"
		/>
	</div>

	<div class="space-y-2">
		<label for="note">Note</label>
		<!-- svelte-ignore element_invalid_self_closing_tag -->
		<textarea
			id="note"
			name="note"
			bind:value={textNote}
			class="h-16 w-full rounded border p-2"
			placeholder="Enter text note"
		/>
	</div>

	<div class="space-y-2">
		<label for="data-link">Link to data</label>
		<input
			id="data-link"
			name="data-link"
			bind:value={linkDataAccess}
			placeholder="Enter link to data set"
			class="w-full rounded border p-2"
		/>
	</div>

	<!-- Map Configuration -->
	<div class="space-y-4 border-t pt-4">
		<h3 class="font-bold">Map Configuration</h3>

		<div class="space-y-2">
			<label for="datasetType">Dataset Type</label>
			<select id="datasetType" bind:value={datasetType} class="w-full rounded border p-2">
				<option value="values">Values</option>
				<option value="binary">Binary</option>
			</select>
		</div>

		<div class="space-y-2">
			<label for="datasetUnit">Unit</label>
			<select
				id="datasetUnit"
				bind:value={datasetUnit}
				class="w-full rounded border p-2"
				disabled={datasetType === 'binary'}
			>
				<option value="fullNumbers">Full Numbers</option>
				<option value="percent">Percentage</option>
			</select>
		</div>

		{#if datasetUnit === 'percent'}
			<div class="space-y-2">
				<label class="flex items-center">
					<input type="checkbox" bind:checked={percentRounded} class="mr-2" />
					Round Percentages
				</label>
			</div>
		{/if}

		{#if datasetType === 'values'}
			<div class="space-y-2">
				<label for="colorSchemeType">Color Scheme Type</label>
				<select
					id="colorSchemeType"
					bind:value={colourSchemeType}
					class="w-full rounded border p-2"
				>
					{#each colorSchemeTypes as type}
						<option value={type}>{type}</option>
					{/each}
				</select>
			</div>

			<div class="space-y-2">
				<label for="colorScheme">Color Scheme</label>
				<select id="colorScheme" bind:value={colourScheme} class="w-full rounded border p-2">
					{#each colorSchemes[colourSchemeType] as scheme}
						<option value={scheme}>{scheme}</option>
					{/each}
				</select>
			</div>

			<div class="space-y-2">
				<label class="flex items-center">
					<input type="checkbox" bind:checked={colourSchemeReverse} class="mr-2" />
					Reverse Color Scheme
				</label>
			</div>

			<div class="space-y-2">
				<label for="colorClasses">Color Classes</label>
				<input
					id="colorClasses"
					type="number"
					min="3"
					max="9"
					bind:value={colourSchemeClasses}
					class="w-full rounded border p-2"
				/>
			</div>
		{/if}

		{#if datasetType === 'values' && scaleBarAvailable}
			<div class="space-y-4 border-t pt-4">
				<h3 class="font-bold">Scale Bar Values</h3>
				<div class="space-y-2">
					<label class="flex items-center">
						<input type="checkbox" bind:checked={overrideScaleValues} class="mr-2" />
						Override Scale Values
					</label>

					{#if overrideScaleValues}
						<div class="mt-2 space-y-2">
							<label for="colorBarFirstValue">First Value</label>
							<input
								id="colorBarFirstValue"
								type="number"
								bind:value={colorBarFirstValue}
								class="w-full rounded border p-2"
							/>
						</div>
						<div class="space-y-2">
							<label for="colorBarLastValue">Last Value</label>
							<input
								id="colorBarLastValue"
								type="number"
								bind:value={colorBarLastValue}
								class="w-full rounded border p-2"
							/>
						</div>
					{/if}
				</div>
			</div>
		{/if}
	</div>

	<!-- Display Options -->
	<div class="space-y-4 border-t pt-4">
		<h3 class="font-bold">Display Options</h3>

		<div class="space-y-2">
			<label class="flex items-center">
				<input type="checkbox" bind:checked={headlineAvailable} class="mr-2" />
				Show Headline
			</label>
			<label class="flex items-center">
				<input type="checkbox" bind:checked={subheadlineAvailable} class="mr-2" />
				Show Subheadline
			</label>
			<label class="flex items-center">
				<input type="checkbox" bind:checked={tooltipAvailable} class="mr-2" />
				Show Tooltips
			</label>
			<label class="flex items-center">
				<input type="checkbox" bind:checked={scaleBarAvailable} class="mr-2" />
				Show Scale Bar
			</label>
			<label class="flex items-center">
				<input type="checkbox" bind:checked={legendAvailable} class="mr-2" />
				Show Legend
			</label>
		</div>
	</div>

	<!-- <button
		class="w-full rounded bg-blue-500 px-4 py-2 text-white hover:bg-blue-600"
		on:click={handleUpdate}
	>
		Update Map
	</button> -->
</div>
