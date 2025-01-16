<script>
	import { onMount } from 'svelte';
	import { feature } from 'topojson-client';
	import { geoPath, geoIdentity } from 'd3-geo';
	import MapControls from './MapControls.svelte';
	import MapTooltip from './MapTooltip.svelte';
	import MapCountries from './MapCountries.svelte';
	import { useMapProjection } from './hooks/useMapProjection';
	import { useMapData } from './hooks/useMapData';
	import { useMapInteractions } from './hooks/useMapInteractions';
	import { createColorScale } from './utils/colorScales';

	export let legend;
	export let tooltip;
	export let extraInfoTexts;
	export let extraInfoLinks;
	export let mapConfig;

	const { projection, path, updateProjection } = useMapProjection();
	const { countriesAll, graticules, countriesWithExtraInfo, loadGeoData, mergeData } = useMapData();

	const { handleMouseMove, handleMouseEnter, handleMouseLeave, handleMouseClick } =
		useMapInteractions();

	const colorScale = createColorScale(mapConfig);

	onMount(async () => {
		await loadGeoData();
		if (mapConfig.parsedData) {
			mergeData(mapConfig.parsedData);
		}
	});
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div id="map" class="relative" on:mousemove={handleMouseMove}>
	{#if mapConfig.scaleBarAvailable}
		<MapControls {colorScale} {mapConfig} />
	{/if}

	<svg preserveAspectRatio="xMinYMid meet" viewBox="0 0 {width} {height}">
		<MapCountries
			{countriesAll}
			{graticules}
			{countriesWithExtraInfo}
			{path}
			{colorScale}
			{mapConfig}
			on:countryEnter={handleMouseEnter}
			on:countryLeave={handleMouseLeave}
			on:countryClick={handleMouseClick}
		/>
	</svg>

	<MapTooltip {tooltip} {mapConfig} />
</div>
