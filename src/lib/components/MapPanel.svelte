<!-- src/lib/components/MapPanel.svelte -->
<script>
	import { page } from '$app/stores';
	import { geoIdentity } from 'd3-geo';
	import { feature } from 'topojson-client';
	import { mapConfig } from '$lib/stores/config-map';
	import { shouldUpdateMap } from '$lib/stores/update-map';
	import { onMount } from 'svelte';
	import { APP_HEIGHT, mobileSize, isMobile } from '$lib/stores/shared';
	import { selectedLanguage } from '$lib/stores/shared';
	import { languageNameTranslations } from '$lib/stores/languages';
	import MapChoropleth from '$lib/components/MapChoropleth.svelte';
	import MapSimple from '$lib/components/MapSimple.svelte';
	import Select from 'svelte-select';

	import { translations } from '$lib/stores/translations';

	let heading;
	let subheading;
	let tooltip;
	let tooltipEntries;
	let textSourceDescription;
	let textSource;
	let textDataAccess;
	let linkDataAccess;
	let linkDataAccessDescription;
	let textNoteDescription;
	let textNote;
	let customUnitLabel;
	let tooltipExtraInfoLabel;

	let textCountryClick;
	let extraInfoTexts;
	let extraInfoLinks;
	let innerWidth;
	let containerHeight;

	let transformedGeoData;

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

	// Your reactive statement stays the same
	$: if ($translations && Object.keys($translations).length > 0 && $selectedLanguage?.value) {
		getLanguage($selectedLanguage.value);
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
		// await getLanguage($selectedLanguage.value);

		if ($mapConfig.translate) {
			translations.set({
				en: $mapConfig.translate // Assuming 'en' is your default language
			});
		}
	});

	// Function called when language dropdown is changed
	async function getLanguage(lang) {
		try {
			shouldUpdateMap.set(false);

			// console.log('Getting language:', lang);
			// console.log('Available translations:', Object.keys($translations));

			const data = $translations[lang];
			if (!data) {
				// console.log('No data found for language:', lang);
				return;
			}

			// console.log('Found translation data:', data);

			// Extract extraInfo entries
			const extraInfoEntries = Object.keys(data).filter((key) => key.startsWith('extraInfo_'));
			// console.log('Extra info entries:', extraInfoEntries);

			// Create the new config object first so we can inspect it
			const newConfig = {
				...$mapConfig,
				title: data.title || '',
				subtitle: data.subtitle || '',
				textSourceDescription: data.textSourceDescription || '',
				textSource: data.textSource || '',
				textNoteDescription: data.textNoteDescription || '',
				textNote: data.textNote || '',
				linkDataAccessDescription: data.linkDataAccessDescription || '',
				legend1: data.legend1 || '',
				customUnitLabel: data.customUnitLabel || '',
				tooltipExtraInfoLabel: data.tooltipExtraInfoLabel || '',
				...Object.fromEntries(extraInfoEntries.map((key) => [key, data[key] || ''])),
				translate: {
					title: data.title || '',
					subtitle: data.subtitle || '',
					textNoteDescription: data.textNoteDescription || '',
					textNote: data.textNote || '',
					textSourceDescription: data.textSourceDescription || '',
					textSource: data.textSource || '',
					linkDataAccessDescription: data.linkDataAccessDescription || '',
					legend1: data.legend1 || '',
					tooltipExtraInfoLabel: data.tooltipExtraInfoLabel || '',
					...Object.fromEntries(extraInfoEntries.map((key) => [key, data[key] || '']))
				}
			};

			// console.log('About to update mapConfig with:', newConfig);

			// Update the store
			mapConfig.set(newConfig);

			// console.log('MapConfig after update:', $mapConfig);

			// Update tooltips
			tooltipEntries = Object.keys(data).filter((item) => item.includes('tooltip'));
			tooltip = tooltipEntries.map((item) => ({
				[item]: data[item],
				label: data[item],
				textCountryClick: data.textCountryClick || ''
			}));

			// Extra Info
			extraInfoTexts = filterAndReduceExtraInfo(data, 'extraInfoText');
			extraInfoLinks = filterAndReduceExtraInfo(data, 'extraInfoLink');
		} catch (error) {
			console.error('Error in getLanguage:', error);
			console.error('Current state:', {
				translations: $translations,
				selectedLanguage: lang,
				mapConfig: $mapConfig
			});
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

<div class={isFullscreen ? 'h-screen w-full overflow-hidden' : 'h-screen w-1/2 overflow-hidden'}>
	<div
		id="euranet-map"
		class="h-full overflow-y-auto {isFullscreen ? 'p-0  pt-0' : 'p-32 pt-12'}"
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
				{#if $mapConfig.title}
					<h1 class="text-xl font-bold">{$mapConfig.title}</h1>
				{/if}
				{#if $mapConfig.subtitle}
					<h3 class="text-md">{$mapConfig.subtitle}</h3>
				{/if}
			</div>

			<div id="chart-body" class="mt-4">
				{#if tooltip}
					<div class="wrapper">
						<MapChoropleth
							mapConfig={$mapConfig}
							{tooltip}
							{extraInfoTexts}
							{extraInfoLinks}
							geoData={transformedGeoData}
						/>
					</div>
				{/if}
			</div>

			<div id="source-notes" class="mt-2 text-xs">
				{#if $mapConfig.textSource}
					<div>
						<span class="font-bold">{$mapConfig.textSourceDescription}: </span>
						<span>{$mapConfig.textSource}</span>
					</div>
				{/if}
				{#if $mapConfig.textNote}
					<div>
						<span class="font-bold">{$mapConfig.textNoteDescription}: </span>
						<span>{$mapConfig.textNote}</span>
					</div>
				{/if}
				{#if $mapConfig.linkDataAccess}
					<div class="underline">
						<a target="_blank" href={$mapConfig.linkDataAccess}
							>{$mapConfig.linkDataAccessDescription}
						</a>
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
