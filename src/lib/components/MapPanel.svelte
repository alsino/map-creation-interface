<!-- src/lib/components/MapPanel.svelte -->
<script>
	import { config } from '$lib/stores/config-features';
	import { onMount } from 'svelte';
	import { APP_HEIGHT, mobileSize, isMobile } from '$lib/stores/shared';
	import { selectedLanguage } from '$lib/stores/shared';
	import { languageNameTranslations } from '$lib/stores/languages';
	import MapChoropleth from '$lib/components/MapChoropleth.svelte';
	import MapSimple from '$lib/components/MapSimple.svelte';
	import Select from 'svelte-select';

	export let mapConfig;

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
	let textNoteDescription;
	let textNote;
	let textCountryClick;
	let extraInfoTexts;
	let extraInfoLinks;
	let innerWidth;
	let containerHeight;

	// Send map height to parent window
	$: {
		if ($APP_HEIGHT) {
			window.parent.postMessage({ height: $APP_HEIGHT }, '*');
		}
	}

	$: dropdownLanguages = languageNameTranslations['en'];
	$: $isMobile = innerWidth <= $mobileSize;

	onMount(async () => {
		await getLanguage($selectedLanguage.value);
	});

	async function getLanguage(lang) {
		const res = await fetch(`/languages/${lang}.json`)
			.then((response) => response.json())
			.then(function (data) {
				heading = data.heading;
				subheading = data.subheading;
				textSourceDescription = data.textSourceDescription;
				textSource = data.textSource;
				textDataAccess = data.textDataAccess;
				linkDataAccess = data.linkDataAccess;
				textNoteDescription = data.textNoteDescription;
				textNote = data.textNote;
				textCountryClick = data.textCountryClick;

				// LEGEND
				legendEntries = Object.keys(data).filter((item) => item.includes('legend'));
				legend = legendEntries.map((item) => ({
					[item]: data[item],
					label: data[item],
					color: config[`${item}Color`]
				}));

				// TOOLTIP
				tooltipEntries = Object.keys(data).filter((item) => item.includes('tooltip'));
				tooltip = tooltipEntries.map((item) => ({
					[item]: data[item],
					label: data[item],
					textCountryClick: textCountryClick
				}));

				// Extra Info
				extraInfoTexts = filterAndReduceExtraInfo('extraInfoText');
				extraInfoLinks = filterAndReduceExtraInfo('extraInfoLink');
			});
	}

	function filterAndReduceExtraInfo(filterTerm) {
		const asArray = Object.entries(data);
		const extraInfoEntries = asArray.filter(([key, value]) => key.includes(filterTerm));

		return extraInfoEntries.reduce(
			(obj, item) =>
				Object.assign(obj, {
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

<div class="h-screen w-1/2 overflow-hidden">
	<div
		id="euranet-map"
		class="flex h-full flex-col p-4"
		bind:clientHeight={$APP_HEIGHT}
		bind:clientWidth={innerWidth}
	>
		<header class="flex-none">
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

		<div id="chart" class="mt-8 flex min-h-0 flex-1 flex-col">
			<div id="chart-header" class="flex-none">
				{#if config.headlineAvailable && heading}
					<h1 class="text-xl font-bold">{heading}</h1>
				{/if}
				{#if config.subheadlineAvailable && subheading}
					<h3 class="text-md">{subheading}</h3>
				{/if}
			</div>

			<div id="chart-body" class="relative mt-4 min-h-0 flex-1">
				{#if legend && tooltip}
					<div class="absolute inset-0">
						<MapChoropleth {legend} {tooltip} {extraInfoTexts} {extraInfoLinks} />
					</div>
				{/if}
			</div>
		</div>

		<div class="mt-2 flex-none text-xs">
			{#if config.textSourceAvailable && textSourceDescription && textSource}
				<div>
					<span class="font-bold">{textSourceDescription}: </span>
					<span>{textSource}</span>
				</div>
			{/if}
			{#if config.textNoteAvailable && textNoteDescription && textNote}
				<div>
					<span class="font-bold">{textNoteDescription}: </span>
					<span>{textNote}</span>
				</div>
			{/if}
			{#if config.textDataAccessAvailable && linkDataAccess && textDataAccess}
				<div class="underline">
					<a target="_blank" href={linkDataAccess}>{textDataAccess}</a>
				</div>
			{/if}
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

	#chart-body {
		position: relative;
		width: 100%;
		height: 100%;
	}
</style>
