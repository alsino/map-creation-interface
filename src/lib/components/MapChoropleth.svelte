<script>
	import { config } from '$lib/stores/config-features';
	import { MOUSE } from '$lib/stores/shared';
	import { onMount } from 'svelte';
	import { csvData } from '$lib/stores/shared';
	import { feature } from 'topojson-client';
	import { geoPath, geoIdentity } from 'd3-geo';
	import { selectedLanguage } from '$lib/stores/shared';
	import { countryNameTranslations } from '$lib/stores/countries';
	import { countryInfoVisible, selectedCountry, isMobile } from '$lib/stores/shared';
	import { scaleQuantile } from 'd3-scale';
	import { extent, min, max } from 'd3-array';
	import { csv } from 'd3-fetch';
	import Scale from './Scale.svelte';
	import Legend from './Legend.svelte';
	import CountryInfo from './CountryInfo.svelte';

	// Props
	export let legend;
	export let tooltip;
	export let extraInfoTexts;
	export let extraInfoLinks;

	// Fixed dimensions and padding
	const width = 600;
	const height = 600;
	const padding = -85; // Using our optimized padding value

	// State variables
	let graticules;
	let countriesAll;
	let countriesWithCsvImport;
	let countriesWithExtraInfo;
	let hoveredCountry;
	let tooltipVisible = false;
	let tooltipHeight;
	let tooltipWidth;
	let scaleMin, scaleMax;

	// Color scaling
	let colorScale = scaleQuantile();
	let colorScheme = [];
	let clusters = [];

	// Setup projection and path
	const projection = geoIdentity().reflectY(true);
	const path = geoPath().projection(projection);

	// Reactive declarations for country names and translations
	$: countryNames = countryNameTranslations?.[$selectedLanguage?.value] || [];

	$: selectedCountryNameTranslated = countryNames?.find(
		(item) => $selectedCountry?.properties?.id && item.id === $selectedCountry.properties.id
	)?.na;

	let selectedCountryExtraInfoTextTranslated;
	let selectedCountryExtraInfoLinkTranslated;

	$: if ($selectedCountry) {
		selectedCountryExtraInfoTextTranslated = extraInfoTexts[$selectedCountry.properties.id];
		selectedCountryExtraInfoLinkTranslated = extraInfoLinks[$selectedCountry.properties.id];
	} else {
		selectedCountryExtraInfoTextTranslated = undefined;
		selectedCountryExtraInfoLinkTranslated = undefined;
	}

	// Setup color scale based on dataset type
	$: if (config.datasetType == 'values') {
		colorScale = scaleQuantile();
	} else if (config.datasetType == 'binary') {
		colorScale = function (value) {
			return value == 1 ? '#2B3163' : '#F4F4F4';
		};
	}

	// Calculate tooltip position
	$: tooltipPositionX = $MOUSE.x < width / 2 ? $MOUSE.x : $MOUSE.x - tooltipWidth;

	async function fetchGeoData() {
		const response = await fetch(`/data/geodata/europe-20m.json`);
		const data = await response.json();
		countriesAll = feature(data, data.objects.cntrg);
		graticules = feature(data, data.objects.gra);

		// Set up projection after data is loaded
		projection.fitExtent(
			[
				[padding, padding],
				[width - padding, height - padding]
			],
			countriesAll
		);
	}

	async function fetchCSV() {
		try {
			const data = await csv('/data/thematic/data.csv');

			// Parse numbers as integers
			data.forEach((d) => {
				d.value = d.value !== 'null' ? +d.value : null;
			});

			let extentArray = data.map((item) => item.value);
			csvData.set(data);

			// Set color scale domain and range
			if (config.datasetType == 'values') {
				colorScale.domain(extent(extentArray)).range(colorScheme);
				clusters = colorScale.quantiles();
				scaleMin = min(extentArray);
				scaleMax = max(extentArray);
			} else {
				clusters = [];
			}
		} catch (error) {
			console.error('Error loading CSV:', error);
		}
	}

	function mergeData() {
		let csvTransformed = $csvData.reduce(
			(obj, item) =>
				Object.assign(obj, {
					[item.id]: {
						value: item.value,
						extraInfo: item.extraInfo.toLowerCase() === 'true',
						contentText: item['text_content'],
						linkText: item['link_text'],
						linkURL: item['link_url_target']
					}
				}),
			{}
		);

		// Add values from csv to features
		countriesAll.features.forEach((item) => {
			if (Object.keys(csvTransformed).includes(item.properties.id)) {
				item.csvImport = csvTransformed[item.properties.id];
			}
		});

		countriesWithCsvImport = countriesAll.features.filter((item) => item.csvImport);
		countriesWithExtraInfo = {
			type: 'FeatureCollection',
			features: countriesWithCsvImport.filter((item) => item.csvImport.extraInfo)
		};
	}

	function getFill(feature) {
		const csvData = feature.csvImport;
		if (!csvData) return '#F4F4F4';
		if (csvData.value === undefined) return '#F4F4F4';
		if (csvData.value === null) return '#CAD1D9';
		return colorScale(csvData.value);
	}

	function getStroke(feature) {
		const csvData = feature.csvImport;
		if (!csvData) return '#cdcdcd';
		if (csvData.value === undefined || csvData.value === null) return '#cdcdcd';
		return csvData.extraInfo ? 'black' : '#cdcdcd';
	}

	function getClass(feature) {
		const csvData = feature.csvImport;
		if (!csvData || !csvData.value) return 'noPointer';
		return 'pointer';
	}

	function handleMouseMove(e) {
		if (!e?.currentTarget) return;

		const rect = e.currentTarget.getBoundingClientRect();
		const mouseX = e.pageX - rect.left;
		const mouseY = e.pageY - rect.top;

		if (hoveredCountry) {
			MOUSE.set({
				x: mouseX,
				y: mouseY,
				tooltip: {
					name: hoveredCountry.name || '',
					value: hoveredCountry.value || null,
					extraInfo: hoveredCountry.extraInfo || false
				}
			});
		}
	}

	function handleMouseEnter(country) {
		if (!config.tooltipAvailable) return;

		const countryName = countryNames.find((c) => c.id == country.properties.id)?.na;

		if (country.csvImport) {
			tooltipVisible = true;
			hoveredCountry = {
				name: countryName,
				value: country.csvImport.value,
				extraInfo: country.csvImport.extraInfo
			};
		} else {
			tooltipVisible = false;
			hoveredCountry = {};
		}
	}

	function handleMouseLeave() {
		if (config.tooltipAvailable) {
			tooltipVisible = false;
		}
	}

	function handleMouseClick(country) {
		if (country.csvImport?.extraInfo) {
			$countryInfoVisible = true;
			$selectedCountry = country;
			if ($isMobile) tooltipVisible = false;
		}
	}

	onMount(async () => {
		await fetchGeoData();
		await fetchCSV();
		mergeData();
	});
</script>

<div id="map" class="relative h-full w-full" on:mousemove={handleMouseMove}>
	{#if config.datasetType == 'values' && config.scaleBarAvailable}
		<Scale classes={colorScheme} {clusters} {scaleMin} {scaleMax} />
	{/if}

	{#if config.legendAvailable}
		<Legend {legend} />
	{/if}

	<svg preserveAspectRatio="xMidYMid meet" viewBox="0 0 {width} {height}" class="h-full w-full">
		{#if graticules}
			{#each graticules.features as feature}
				<path d={path(feature)} stroke="#cfcfcf" fill="transparent" class="noPointer" />
			{/each}
		{/if}

		{#if countriesAll}
			{#each countriesAll.features as feature}
				<path
					d={path(feature)}
					stroke={getStroke(feature)}
					fill={getFill(feature)}
					class={getClass(feature)}
					on:mouseenter={() => handleMouseEnter(feature)}
					on:mouseleave={handleMouseLeave}
					on:click={() => handleMouseClick(feature)}
				/>
			{/each}
		{/if}

		{#if countriesWithExtraInfo}
			{#each countriesWithExtraInfo.features as feature}
				<path
					d={path(feature)}
					stroke={getStroke(feature)}
					fill={getFill(feature)}
					class={config.datasetType == 'values'
						? 'country-extra-info-values'
						: 'country-extra-info-binary'}
					on:mouseenter={() => handleMouseEnter(feature)}
					on:mouseleave={handleMouseLeave}
					on:click={() => handleMouseClick(feature)}
					on:touchstart={() => {
						handleMouseEnter(feature);
						handleMouseClick(feature);
					}}
				/>
			{/each}
		{/if}
	</svg>

	<CountryInfo
		selectedCountry={$selectedCountry}
		countryName={selectedCountryNameTranslated}
		countryText={selectedCountryExtraInfoTextTranslated}
		countryLink={selectedCountryExtraInfoLinkTranslated}
		{tooltip}
	/>

	<div
		class="tooltip p-3 text-sm {tooltipVisible ? 'active' : ''}"
		style="top: {$MOUSE.y - tooltipHeight}px; left:{tooltipPositionX}px;"
		bind:clientHeight={tooltipHeight}
		bind:clientWidth={tooltipWidth}
	>
		<div class="tooltip-head font-bold">{$MOUSE.tooltip?.name}</div>
		<div class="tooltip-body space-y-1">
			{#each tooltip as tip}
				{#if config.datasetType == 'values'}
					<div class="values">
						{#if config.datasetUnit == 'percent'}
							<span class="font-bold">
								{config.percentRounded
									? `${Math.round($MOUSE.tooltip?.value * 100)}%`
									: `${((($MOUSE.tooltip?.value || 0) * 1000) / 10).toFixed(1)}%`}
							</span>
						{:else if config.datasetUnit == 'fullNumbers'}
							<span class="font-bold">{$MOUSE.tooltip?.value}</span>
						{/if}
						<span>{tip.label}</span>
					</div>
				{/if}
				{#if $MOUSE.tooltip?.extraInfo}
					<div class="text-xs">
						<span class="icon-tap"></span>{tip.textCountryClick}
					</div>
				{/if}
			{/each}
		</div>
	</div>
</div>

<style>
	#map {
		position: relative;
		width: 100%;
		height: 100%;
	}

	svg {
		width: 100%;
		height: 100%;
		display: block;
	}

	svg path {
		stroke-width: 0.5px;
		cursor: pointer;
		stroke-linecap: round;
	}

	.country-extra-info-values {
		stroke: black;
	}

	.country-extra-info-values:hover {
		stroke-width: 1px;
	}

	.country-extra-info-binary {
		stroke: green;
	}

	.noPointer {
		pointer-events: none;
	}

	.pointer {
		pointer-events: all;
	}

	.tooltip {
		text-align: left;
		position: absolute;
		pointer-events: none;
		display: none;
		background: white;
		border-radius: 3px;
		z-index: 0;
		box-shadow: 0 10px 20px 0 rgba(185, 185, 185, 0.25);
	}

	.tooltip-head {
		padding-bottom: 0.5rem;
		border-bottom: 1px solid #e2e2e2;
	}

	.tooltip-body {
		padding-top: 0.5rem;
	}

	.active {
		display: block;
	}
</style>
