<!-- src/lib/components/MapPanel.svelte -->
<script>
	import { page } from '$app/stores';
	import { geoIdentity } from 'd3-geo';
	import { feature } from 'topojson-client';
	import { mapConfig } from '$lib/stores/config-map';
	import { onMount } from 'svelte';
	import { APP_HEIGHT, mobileSize, isMobile } from '$lib/stores/shared';
	import { selectedLanguage } from '$lib/stores/shared';
	import { languageNameTranslations } from '$lib/stores/languages';
	import MapChoropleth from '$lib/components/MapChoropleth.svelte';
	import MapSimple from '$lib/components/MapSimple.svelte';
	import Select from 'svelte-select';

	let heading;
	let subheading;
	let legend;
	let legendEntries;
	let tooltip;
	let tooltipEntries;
	let textSourceDescription;
	let textSource;
	let textDataAccess;
	let linkDataAccess;
	let linkDataAccessDescription;
	let textNoteDescription;
	let textNote;
	let textCountryClick;
	let extraInfoTexts;
	let extraInfoLinks;
	let innerWidth;
	let containerHeight;

	let transformedGeoData;

	$: console.log($mapConfig);

	async function fetchAndTransformGeoData() {
		const res = await fetch('/data/geodata/europe-20m.json');
		const data = await res.json();

		const width = 600;
		const height = 600;
		const padding = -60;

		const projection = geoIdentity().reflectY(true);
		projection.fitExtent(
			[
				[padding, padding],
				[width - padding, height - padding]
			],
			feature(data, data.objects.cntrg)
		);

		transformedGeoData = {
			countries: feature(data, data.objects.cntrg),
			graticules: feature(data, data.objects.gra)
		};
	}

	// Get the view parameter from the page store
	$: isFullscreen = $page.url.searchParams.get('view') === 'fullscreen';

	// Send map height to parent window
	// $: {
	// 	if ($APP_HEIGHT) {
	// 		window.parent.postMessage({ height: $APP_HEIGHT }, '*');
	// 	}
	// }

	$: dropdownLanguages = languageNameTranslations['en'];
	$: $isMobile = innerWidth <= $mobileSize;

	onMount(async () => {
		await fetchAndTransformGeoData();
		await getLanguage($selectedLanguage.value);
	});

	async function getLanguage(lang) {
		try {
			console.log('Fetching language:', lang);
			const response = await fetch(`/languages/${lang}.json`);
			if (!response.ok) {
				throw new Error(`Failed to load language file: ${response.statusText}`);
			}

			const data = await response.json();
			console.log('Language data loaded:', data);

			heading = data.title;
			subheading = data.subtitle;
			textSourceDescription = data.textSourceDescription;
			textSource = data.textSource;
			textNoteDescription = data.textNoteDescription;
			textNote = data.textNote;
			linkDataAccessDescription = data.linkDataAccessDescription;

			// // Update mapConfig with translated values
			// mapConfig.set({
			// 	...$mapConfig, // Spread the current values
			// 	title: data.title,
			// 	subtitle: data.subtitle,
			// 	textSourceDescription: data.textSourceDescription,
			// 	textSource: data.textSource,
			// 	textNoteDescription: data.textNoteDescription,
			// 	textNote: data.textNote,
			// 	linkDataAccessDescription: data.linkDataAccessDescription,
			// 	// Preserve other mapConfig values but update translate object
			// 	translate: {
			// 		title: data.title,
			// 		subtitle: data.subtitle,
			// 		textNoteDescription: data.textNoteDescription,
			// 		textNote: data.textNote,
			// 		textSourceDescription: data.textSourceDescription,
			// 		textSource: data.textSource,
			// 		linkDataAccessDescription: data.linkDataAccessDescription,
			// 		// Keep existing extraInfo entries
			// 		...Object.fromEntries(
			// 			Object.entries(data)
			// 				.filter(([key]) => key.startsWith('extraInfo_'))
			// 				.map(([key, value]) => [key, value])
			// 		)
			// 	}
			// });

			console.log('Updated mapConfig:', $mapConfig);

			// LEGEND
			legendEntries = Object.keys(data).filter((item) => item.includes('legend'));
			legend = legendEntries.map((item) => ({
				[item]: data[item],
				label: data[item],
				color: $mapConfig[`${item}Color`]
			}));

			// TOOLTIP
			tooltipEntries = Object.keys(data).filter((item) => item.includes('tooltip'));
			tooltip = tooltipEntries.map((item) => ({
				[item]: data[item],
				label: data[item],
				textCountryClick: data.textCountryClick
			}));

			// Extra Info
			extraInfoTexts = filterAndReduceExtraInfo(data, 'extraInfoText');
			extraInfoLinks = filterAndReduceExtraInfo(data, 'extraInfoLink');
		} catch (error) {
			console.error('Error loading language file:', error);
		}
	}

	// Fixed filterAndReduceExtraInfo function
	function filterAndReduceExtraInfo(data, filterTerm) {
		const asArray = Object.entries(data);
		const extraInfoEntries = asArray.filter(([key]) => key.includes(filterTerm));

		return extraInfoEntries.reduce(
			(obj, item) => ({
				...obj,
				[item[0].split('_')[1]]: item[1]
			}),
			{}
		);
	}

	function handleSelect(event) {
		$selectedLanguage = { value: event.detail.value, label: event.detail.label };
		getLanguage($selectedLanguage.value);
	}
</script>

<div class={isFullscreen ? 'h-screen w-full' : 'w-1/2'}>
	<div
		id="euranet-map"
		class="h-full {isFullscreen ? 'p-0' : 'p-4'}"
		bind:clientHeight={$APP_HEIGHT}
		bind:clientWidth={innerWidth}
	>
		<header>
			<div class="logo">
				<img
					src="./img/logo.png"
					srcset="./img/logo.png 1x, ./img/logo@2x.png 2x"
					alt="Logo EuraNet"
				/>
			</div>
			<div class="select">
				<Select
					items={dropdownLanguages}
					value={$selectedLanguage}
					placeholder="Select a language …"
					noOptionsMessage="No language found"
					on:select={handleSelect}
				/>
			</div>
		</header>

		<div id="chart" class="mt-8">
			<div id="chart-header">
				{#if heading}
					<h1 class="text-xl font-bold">{heading}</h1>
				{/if}
				{#if subheading}
					<h3 class="text-md">{subheading}</h3>
				{/if}
			</div>

			<div id="chart-body" class="mt-4">
				{#if legend && tooltip}
					<div class="wrapper">
						<MapChoropleth
							mapConfig={$mapConfig}
							{legend}
							{tooltip}
							{extraInfoTexts}
							{extraInfoLinks}
							geoData={transformedGeoData}
						/>
					</div>
				{/if}
			</div>

			<div id="source-notes" class="mt-2 text-xs">
				{#if textSource}
					<div>
						<span class="font-bold">{textSourceDescription}: </span>
						<span>{textSource}</span>
					</div>
				{/if}
				{#if textNote}
					<div>
						<span class="font-bold">{textNoteDescription}: </span>
						<span>{textNote}</span>
					</div>
				{/if}
				{#if $mapConfig.linkDataAccess}
					<div class="underline">
						<a target="_blank" href={$mapConfig.linkDataAccess}>{linkDataAccessDescription}</a>
					</div>
				{/if}
			</div>
		</div>
	</div>
</div>

<style>
	:global(body) {
		margin: 0;
		text-align: center;
		font-family: Arial, Helvetica, sans-serif;
		color: #2b3163;
	}

	header {
		display: flex;
		align-items: center;
	}

	.logo {
		flex: 1;
	}

	.select {
		flex: 1;
	}

	div {
		text-align: left;
	}

	#euranet-map {
		background: white;
	}

	.wrapper {
		display: block;
		width: 100%;
	}
</style>
