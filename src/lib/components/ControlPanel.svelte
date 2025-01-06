<!-- src/lib/components/ControlPanel.svelte -->
<script>
	import { mapConfig } from '$lib/stores/config-map';
	import { dataReady } from '$lib/stores/shared';
	import { csvParse } from 'd3-dsv';

	// Add at the top of script
	const EU_COUNTRY_CODES = new Set([
		'AT',
		'BE',
		'BG',
		'CY',
		'CZ',
		'DE',
		'DK',
		'EE',
		'EL',
		'ES',
		'FI',
		'FR',
		'HR',
		'HU',
		'IE',
		'IT',
		'LT',
		'LU',
		'LV',
		'MT',
		'NL',
		'PL',
		'PT',
		'RO',
		'SE',
		'SI',
		'SK'
	]);

	let csvError = null;
	let csvWarnings = [];
	const REQUIRED_COLUMNS = ['country', 'id', 'value', 'extraInfo'];
	const CSV_EXAMPLE = `country,id,value,extraInfo
Austria,AT,35,false
Belgium,BE,83,false`;

	const EXAMPLE_DATA = `country,id,value,extraInfo,text_content,link_text,link_url_target,audio_url_1,audio_url_2,audio_url_3,image_url_source,image_url_target,video_url
Austria,AT,0.035,FALSE,,,,,,,,,
Belgium,BE,0.083,FALSE,,,,,,,,,
Bulgaria,BG,-0.108,FALSE,,,,,,,,,
Cyprus,CY,0.157,FALSE,,,,,,,,,
Czechia,CZ,-0.002,FALSE,,,,,,,,,
Germany,DE,-0.040,FALSE,,,,,,,,,
Denmark,DK,0.036,FALSE,,,,,,,,,
Estonia,EE,0.047,FALSE,,,,,,,,,
Greece,EL,0.006,FALSE,,,,,,,,,
Spain,ES,0.132,FALSE,,,,,,,,,
Finland,FI,0.069,FALSE,,,,,,,,,
France,FR,0.045,FALSE,,,,,,,,,
Croatia,HR,0.000,FALSE,,,,,,,,,
Hungary,HU,-0.019,FALSE,,,,,,,,,
Ireland,IE,0.243,FALSE,,,,,,,,,
Italy,IT,0.026,FALSE,,,,,,,,,
Lithuania,LT,-0.072,FALSE,,,,,,,,,
Luxembourg,LU,0.239,FALSE,,,,,,,,,
Latvia,LV,0.013,FALSE,,,,,,,,,
Malta,MT,0.245,FALSE,,,,,,,,,
Netherlands,NL,-0.001,FALSE,,,,,,,,,
Poland,PL,0.027,FALSE,,,,,,,,,
Portugal,PT,-0.004,FALSE,,,,,,,,,
Romania,RO,0.090,FALSE,,,,,,,,,
Sweden,SE,0.202,FALSE,,,,,,,,,
Slovenia,SI,-0.020,FALSE,,,,,,,,,
Slovakia,SK,0.066,FALSE,,,,,,,,,`;

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
	let customUnitLabelAvailable = $mapConfig.customUnitLabelAvailable;
	let customUnitLabel = $mapConfig.customUnitLabel;

	$: mapConfig.set({
		title: title,
		subtitle: subtitle,
		colourSchemeClasses: colourSchemeClasses,
		data: data,
		parsedData: data?.trim() ? parsedData || $mapConfig.parsedData : null,
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
		colorBarLastValue: colorBarLastValue,
		customUnitLabelAvailable: customUnitLabelAvailable,
		customUnitLabel: customUnitLabel
	});

	$: data && handleCSVChange(data);

	function handleCSVChange(csvText) {
		csvError = null;
		csvWarnings = [];

		if (!csvText?.trim()) {
			mapConfig.update((m) => ({
				...m,
				parsedData: null,
				clusters: [],
				colorScale: null
			}));
			return;
		}

		try {
			const parsed = csvParse(csvText);

			// Check for required columns
			const missingColumns = REQUIRED_COLUMNS.filter((col) => !parsed.columns.includes(col));
			if (missingColumns.length > 0) {
				csvError = `Missing required columns: ${missingColumns.join(', ')}`;
				mapConfig.update((m) => ({ ...m, parsedData: null })); // Reset map data
				return;
			}

			// Rest of your existing validation code...
			const seenIds = new Set();

			// Validate data types and handle empty values
			const validatedData = parsed.map((d, index) => {
				const rowNum = index + 1;

				// Your existing validation code...
				Object.keys(d).forEach((key) => {
					if (typeof d[key] === 'string') {
						d[key] = d[key].trim();
					}
				});

				// All your existing validations...
				if (!d.country) {
					throw new Error(`Row ${rowNum}: Missing country name`);
				}

				if (!/^[a-zA-Z\s-]+$/.test(d.country)) {
					throw new Error(`Row ${rowNum}: Country name contains invalid characters`);
				}

				if (!d.id) {
					throw new Error(`Row ${rowNum}: Missing ID`);
				}

				if (!EU_COUNTRY_CODES.has(d.id)) {
					throw new Error(
						`Row ${rowNum}: Invalid country code "${d.id}". Must be a valid EU country code.`
					);
				}

				if (seenIds.has(d.id)) {
					throw new Error(`Row ${rowNum}: Duplicate country code "${d.id}"`);
				}
				seenIds.add(d.id);

				if (d.value !== 'null' && d.value !== '') {
					const numValue = +d.value;
					if (isNaN(numValue)) {
						throw new Error(
							`Row ${rowNum}: Invalid value "${d.value}" - must be a number or "null"`
						);
					}
				}

				const extraInfo = d.extraInfo.toLowerCase();
				if (!['true', 'false', ''].includes(extraInfo)) {
					throw new Error(`Row ${rowNum}: extraInfo must be "true" or "false"`);
				}

				return {
					...d,
					value: d.value === 'null' || d.value === '' ? null : +d.value,
					extraInfo: extraInfo === 'true'
				};
			});

			// Check for missing EU countries
			const includedCountries = new Set(validatedData.map((d) => d.id));
			const missingEUCountries = [...EU_COUNTRY_CODES].filter(
				(code) => !includedCountries.has(code)
			);
			if (missingEUCountries.length > 0) {
				csvWarnings.push(`Missing data for countries: ${missingEUCountries.join(', ')}`);
			}

			// After validation succeeds, update mapConfig with fresh state
			mapConfig.update((m) => ({
				...m,
				parsedData: validatedData,
				clusters: [], // Reset clusters
				colorScale: null // Reset color scale
			}));
		} catch (error) {
			csvError = `Error parsing CSV: ${error.message}`;
			mapConfig.update((m) => ({ ...m, parsedData: null }));
		}
	}

	function handleColorOrderChange(value) {
		colourSchemeReverse = value;
		mapConfig.update((m) => ({
			...m,
			colourSchemeReverse: value
		}));
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
			class="h-32 w-full rounded border p-2 {csvError
				? 'border-red-500'
				: csvWarnings.length
					? 'border-yellow-500'
					: ''}"
			placeholder="Paste CSV data here"
		/>
		<button
			on:click={() => (data = EXAMPLE_DATA)}
			class="text-sm text-blue-600 hover:text-blue-800 hover:underline"
			type="button"
		>
			Load Example Data
		</button>
		{#if csvError}
			<div class="mt-1 text-sm text-red-600">
				<p>{csvError}</p>
			</div>
		{/if}
		{#if csvWarnings.length > 0}
			<div class="mt-1 text-sm text-yellow-600">
				{#each csvWarnings as warning}
					<p>⚠️ {warning}</p>
				{/each}
			</div>
		{/if}
		<div class="mt-1 text-xs text-gray-500">
			<p>Required columns: {REQUIRED_COLUMNS.join(', ')}</p>
			<details class="mt-1">
				<summary class="cursor-pointer">Show format example</summary>
				<pre class="mt-2 rounded bg-gray-100 p-2">{CSV_EXAMPLE}</pre>
			</details>
		</div>
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
					Round Percentages (to nearest whole number)
				</label>
			</div>
		{/if}

		<div class="space-y-2">
			<label class="flex items-center">
				<input type="checkbox" bind:checked={customUnitLabelAvailable} class="mr-2" />
				Custom Tooltip Label
			</label>
		</div>

		{#if customUnitLabelAvailable}
			<div class="space-y-2">
				<input
					id="data-link"
					name="data-link"
					bind:value={customUnitLabel}
					placeholder="e.g. of GDP"
					class="w-full rounded border p-2"
				/>
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
				<label>Color Scheme Order</label>
				<div class="flex gap-4">
					<label class="flex items-center">
						<input
							type="radio"
							name="colorOrder"
							checked={!colourSchemeReverse}
							on:change={() => handleColorOrderChange(false)}
							class="mr-2"
						/>
						Normal
					</label>
					<label class="flex items-center">
						<input
							type="radio"
							name="colorOrder"
							checked={colourSchemeReverse}
							on:change={() => handleColorOrderChange(true)}
							class="mr-2"
						/>
						Reversed
					</label>
				</div>
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
				<input type="checkbox" bind:checked={legendAvailable} class="mr-2" />
				Show Legend
			</label>
			<label class="flex items-center">
				<input type="checkbox" bind:checked={scaleBarAvailable} class="mr-2" />
				Show Scale Bar
			</label>
		</div>

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
</div>
