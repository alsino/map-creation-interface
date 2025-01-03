<script>
	// import { config } from '$lib/stores/config-features';
	import { MOUSE } from '$lib/stores/shared';
	import { onMount } from 'svelte';
	import { CENTER_ON } from '$lib/stores/shared';
	import { csvData } from '$lib/stores/shared';
	import { feature } from 'topojson-client';
	import { geoPath, geoIdentity } from 'd3-geo';
	import { dataReady } from '$lib/stores/shared';
	import { MAP_WIDTH } from '$lib/stores/shared';
	import { selectedLanguage } from '$lib/stores/shared';
	import { countryNameTranslations } from '$lib/stores/countries';
	import { countryInfoVisible } from '$lib/stores/shared';
	import { selectedCountry } from '$lib/stores/shared';
	import { isMobile } from '$lib/stores/shared';

	import { csv } from 'd3-fetch';
	import { extent } from 'd3-array';
	import { min, max } from 'd3-array';

	import { scaleQuantile } from 'd3-scale';
	import {
		// sequential
		schemeBlues, // blue
		schemeGreens, // green
		schemeGreys, // gray
		schemeOranges, // orange
		schemePurples, // purple
		schemeReds, // red
		schemeBuGn, // blue-green
		schemeBuPu, // blue-purple
		schemeGnBu, // green-blue
		schemeOrRd, // orange-red
		schemePuBuGn, // purple-blue-green
		schemePuBu, // purple-blue
		schemePuRd, //purple-red
		schemeRdPu, // red-purple
		schemeYlGnBu, // yellow-green-blue
		schemeYlGn, // yellow-green
		schemeYlOrBr, // yellow-orange-brown
		schemeYlOrRd, // yellow-orange-red
		// diverging
		schemeBrBG, // brown-bluegreen
		schemePRGn, // purple-green
		schemePiYG, // pink-yellowgreen
		schemePuOr, // purple-orange
		schemeRdBu, // red-blue
		schemeRdGy, // red-gray
		schemeRdYlBu, // red-yellow-blue
		schemeRdYlGn, // red-yellow-green
		schemeSpectral // spectral
	} from 'd3-scale-chromatic';

	import { PuBlueDarker } from '$lib/utils/customColorPalettes';
	import { formatInt } from '$lib/utils/formatNumbers';

	import Scale from './Scale.svelte';
	import Legend from './Legend.svelte';
	import CountryInfo from './CountryInfo.svelte';

	// Make square dimensions i.e. 600x600 to fill all space
	let width = 600;
	let height = 600;
	let paddingMap = -85;
	let center;
	let scaleMin, scaleMax;

	export let legend;
	export let tooltip;
	export let extraInfoTexts;
	export let extraInfoLinks;
	export let mapConfig;

	// $: console.log('mapConfig', mapConfig);

	$: countryNames = countryNameTranslations[$selectedLanguage.value];

	$: selectedCountryNameTranslated = countryNames.filter((item) => {
		if ($selectedCountry != undefined) {
			return item.id == $selectedCountry.properties.id;
		} else {
			return {};
		}
	})[0].na;

	let selectedCountryExtraInfoTextTranslated;
	let selectedCountryExtraInfoLinkTranslated;

	$: if ($selectedCountry) {
		selectedCountryExtraInfoTextTranslated = extraInfoTexts[$selectedCountry.properties.id];
		selectedCountryExtraInfoLinkTranslated = extraInfoLinks[$selectedCountry.properties.id];
		// console.log(selectedCountryExtraInfoTextTranslated);
	} else {
		selectedCountryExtraInfoTextTranslated = undefined;
		selectedCountryExtraInfoLinkTranslated = undefined;
	}

	let tooltipVisible = false;
	let tooltipHeight;
	let tooltipWidth;

	let graticules;
	let countriesAll;
	let countriesWithCsvImport;
	let countriesWithExtraInfo;
	let hoveredCountry;

	// Add reactive statement for parsedData
	$: if (mapConfig.parsedData && countriesAll) {
		mergeData();
	}

	$: if ($CENTER_ON === 'europe') {
		paddingMap = -85;
		center = countriesAll;
	}

	$: tooltipPositionX = $MOUSE.x < $MAP_WIDTH / 2 ? $MOUSE.x : $MOUSE.x - tooltipWidth;

	const projection = geoIdentity().reflectY(true);
	const path = geoPath().projection(projection);
	let colorScale = scaleQuantile();
	let colorScheme;
	let clusters;

	$: if (mapConfig.datasetType == 'values') {
		colorScale = scaleQuantile();
	} else if (mapConfig.datasetType == 'binary') {
		colorScale = function (value) {
			return value == 1 ? '#2B3163' : '#F4F4F4';
		};
	}

	// Reactive declarations
	$: colorScaleType = mapConfig.colourSchemeType;
	$: n = mapConfig.colourSchemeClasses;

	// Validate and select color scheme based on config
	$: colorScheme =
		colorScaleType !== 'unknown' &&
		colorSchemeMap[colorScaleType] &&
		colorSchemeMap[colorScaleType][mapConfig.colourScheme]
			? mapConfig.colourSchemeReverse
				? [...colorSchemeMap[colorScaleType][mapConfig.colourScheme]].reverse()
				: colorSchemeMap[colorScaleType][mapConfig.colourScheme]
			: colorSchemeMap['sequential'].red;

	// And add this reactive statement after it to force the color scale to update:
	$: {
		if (mapConfig.datasetType === 'values' && colorScheme) {
			colorScale.domain(extent(extentArray)).range(colorScheme);
			clusters = colorScale.quantiles();
		}
	}

	// Color scheme map, with a fallback for missing classes (fallback to 5 classes)
	$: colorSchemeMap = {
		sequential: {
			blue: schemeBlues[n] || schemeBlues[5], // Fallback to 5 classes if 'n' is out of range
			green: schemeGreens[n] || schemeGreens[5],
			gray: schemeGreys[n] || schemeGreys[5],
			orange: schemeOranges[n] || schemeOranges[5],
			purple: schemePurples[n] || schemePurples[5],
			red: schemeReds[n] || schemeReds[5],
			'blue-green': schemeBuGn[n] || schemeBuGn[5],
			'blue-purple': schemeBuPu[n] || schemeBuPu[5],
			'green-blue': schemeGnBu[n] || schemeGnBu[5],
			'orange-red': schemeOrRd[n] || schemeOrRd[5],
			'purple-blue-green': schemePuBuGn[n] || schemePuBuGn[5],
			'purple-blue': schemePuBu[n] || schemePuBu[5],
			'purple-blue-darker': PuBlueDarker, // Fallback already set
			'purple-red': schemePuRd[n] || schemePuRd[5],
			'red-purple': schemeRdPu[n] || schemeRdPu[5],
			'yellow-green-blue': schemeYlGnBu[n] || schemeYlGnBu[5],
			'yellow-green': schemeYlGn[n] || schemeYlGn[5],
			'yellow-orange-brown': schemeYlOrBr[n] || schemeYlOrBr[5],
			'yellow-orange-red': schemeYlOrRd[n] || schemeYlOrRd[5]
		},
		diverging: {
			'brown-blue-green': schemeBrBG[n] || schemeBrBG[5],
			'purple-green': schemePRGn[n] || schemePRGn[5],
			'pink-yellow-green': schemePiYG[n] || schemePiYG[5],
			'purple-orange': schemePuOr[n] || schemePuOr[5],
			'red-blue': schemeRdBu[n] || schemeRdBu[5],
			'red-gray': schemeRdGy[n] || schemeRdGy[5],
			'red-yellow-blue': schemeRdYlBu[n] || schemeRdYlBu[5],
			'red-yellow-green': schemeRdYlGn[n] || schemeRdYlGn[5],
			spectral: schemeSpectral[n] || schemeSpectral[5]
		}
	};

	const padding = -85;

	$: if ($dataReady) {
		projection.fitExtent(
			[
				[paddingMap, paddingMap],
				[width - paddingMap, height - paddingMap]
			],
			center
		);
	}

	async function fetchGeoData() {
		const res = await fetch(`/data/geodata/europe-20m.json`)
			.then((response) => response.json())
			.then(function (data) {
				countriesAll = feature(data, data.objects.cntrg);
				graticules = feature(data, data.objects.gra);

				projection.fitExtent(
					[
						[paddingMap, paddingMap],
						[width - paddingMap, height - paddingMap]
					],
					countriesAll
				);
			});
	}

	// async function fetchCSV() {
	// 	const res = await csv('/data/thematic/data.csv')
	// 		.then(function (data) {
	// 			// Parse numbers as integers
	// 			data.forEach(function (d) {
	// 				if (d.value !== 'null') {
	// 					d['value'] = +d['value'];
	// 				} else {
	// 					d['value'] = null;
	// 				}
	// 			});

	// 			let extentArray = data.map((item) => {
	// 				return item.value;
	// 			});
	// 			csvData.set(data);

	// 			// Set color scale domain and range
	// 			if (mapConfig.datasetType == 'values') {
	// 				colorScale.domain(extent(extentArray)).range(colorScheme);
	// 				clusters = colorScale.quantiles();
	// 				scaleMin = min(extentArray);
	// 				scaleMax = max(extentArray);
	// 			} else {
	// 				clusters = [];
	// 			}
	// 		})
	// 		.catch((error) => console.error('error', error));
	// }

	$: mapConfig.parsedData && mergeData();
	// $: console.log('mapConfig.parsedData', mapConfig.parsedData);

	// Calculate data extent for colorScale
	let extentArray = mapConfig?.parsedData
		? mapConfig.parsedData
				.map((item) => item?.value)
				.filter((value) => value != null && !isNaN(+value))
		: [];

	// console.log('Extent Array (calculated once):', extentArray);

	$: {
		if (extentArray.length === 0) {
			console.warn('No valid data values found in extentArray.');
		} else if (mapConfig.datasetType === 'values') {
			if (colorScale?.domain && colorScale?.range && Array.isArray(colorScheme)) {
				colorScale.domain(extent(extentArray)).range(colorScheme);
				clusters = colorScale.quantiles();
				scaleMin = min(extentArray);
				scaleMax = max(extentArray);
			} else {
				console.error('Invalid colorScheme or colorScale configuration.');
			}
		} else {
			clusters = [];
		}
	}

	function mergeData() {
		if (!mapConfig.parsedData) return;

		let csvTransformed = mapConfig.parsedData.reduce(
			(obj, item) => ({
				...obj,
				[item.id]: {
					value: item.value,
					extraInfo: item.extraInfo,
					contentText: item.text_content,
					linkText: item.link_text,
					linkURL: item.link_url_target,
					audioURL1: item.audio_url_1,
					audioURL2: item.audio_url_2,
					audioURL3: item.audio_url_3,
					imageSourceURL: item.image_url_source,
					imageTargetURL: item.image_url_target,
					videoURL: item.video_url
				}
			}),
			{}
		);

		if (countriesAll) {
			countriesAll.features.map((item) => {
				if (Object.keys(csvTransformed).includes(item.properties.id)) {
					item.csvImport = csvTransformed[item.properties.id];
				}
			});

			countriesWithCsvImport = countriesAll.features.filter((item) => {
				return item.csvImport;
			});

			countriesWithExtraInfo = countriesWithCsvImport.filter((item) => {
				return item.csvImport.extraInfo == true;
			});

			countriesWithExtraInfo = {
				type: 'FeatureCollection',
				features: countriesWithExtraInfo
			};

			// console.log('countriesWithCsvImport', countriesWithCsvImport);
			$dataReady = true;
		}
	}

	onMount(async () => {
		await fetchGeoData();
		// await fetchCSV();
		await mergeData();
	});

	function getFill(feature) {
		// console.log('feature', feature);
		let csvData = feature.csvImport;

		if (csvData) {
			// No data, because country not in Europe: => value: undefined
			if (csvData.value !== undefined) {
				// No data because not available for this country => value: null
				if (csvData.value !== null) {
					return colorScale(csvData.value);
				} else {
					return '#CAD1D9';
				}
			}
		} else {
			return '#E0E0E0';
		}
	}

	function getStroke(feature) {
		let csvData = feature.csvImport;

		if (csvData) {
			// No data, because country not in Europe: => value: undefined
			if (csvData.value !== undefined) {
				// No data because not available for this country => value:
				if (csvData.value !== null) {
					if (csvData.extraInfo) {
						// return 'orange';
					} else {
						return '#cdcdcd';
					}
					return 'white';
				}
			}
		} else {
			return '#cdcdcd';
		}
	}

	function getClass(feature) {
		let csvData = feature.csvImport;

		if (csvData) {
			if (csvData.value) {
				return 'pointer';
			} else {
				return 'noPointer';
			}
		} else {
			return 'noPointer';
		}
	}

	function handleMouseMove(e) {
		let divOffset = offset(e.currentTarget);

		let mouseX = e.pageX - divOffset.left;
		let mouseY = e.pageY - divOffset.top;
		// console.log(mouseX);

		if (hoveredCountry) {
			// console.log(hoveredCountry);
			MOUSE.set({
				x: mouseX,
				y: mouseY,
				tooltip: {
					name: hoveredCountry.name,
					value: hoveredCountry.value,
					valuePercent: hoveredCountry.valuePercent,
					extraInfo: hoveredCountry.extraInfo
				}
			});
		}

		// Calculate the position of the map div in the page to get mouse position
		function offset(el) {
			let rect = el.getBoundingClientRect(),
				scrollLeft = window.pageXOffset || document.documentElement.scrollLeft,
				scrollTop = window.pageYOffset || document.documentElement.scrollTop;
			return { top: rect.top + scrollTop, left: rect.left + scrollLeft };
		}
	}

	$: handleMouseEnter = function (country) {
		if (mapConfig.tooltipAvailable) {
			let countryName = countryNames.filter((c) => {
				return c.id == country.properties.id;
			})[0].na;

			// set hoveredCountry only if csvImport object is present in data
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
	};

	$: handleMouseLeave = function (country) {
		if (mapConfig.tooltipAvailable) {
			tooltipVisible = false;
		}
	};

	function handleMouseClick(country) {
		if (country.csvImport.extraInfo) {
			$countryInfoVisible = true;
			$selectedCountry = country;

			// on mobile close tooltip when clicked on country with extra info
			if ($isMobile) {
				tooltipVisible = false;
			}
		}
	}

	$: handleTouchStart = function (country) {
		handleMouseEnter(country);
		handleMouseClick(country);
	};

	// $: console.log('countriesAll', countriesAll);
</script>

{#if $dataReady}
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div id="map" class="relative h-full w-full" on:mousemove={handleMouseMove}>
		{#if mapConfig.datasetType == 'values'}
			{#if mapConfig.scaleBarAvailable}
				<Scale classes={colorScheme} {clusters} {scaleMin} {scaleMax} {mapConfig} />
			{/if}
		{/if}

		{#if mapConfig.legendAvailable}
			<Legend {legend} />
		{/if}

		<svg preserveAspectRatio="xMidYMid meet" viewBox="0 0 600 600" class="h-full w-full">
			<!-- graticules (lines) -->
			{#each graticules.features as feature, index}
				<path d={path(feature)} stroke="#cfcfcf" fill="transparent" class="noPointer" />
			{/each}

			<!-- countriesAll -->
			{#each countriesAll.features as feature, index}
				<!-- svelte-ignore a11y_click_events_have_key_events -->
				<path
					d={path(feature)}
					stroke={getStroke(feature)}
					fill={getFill(feature)}
					class={getClass(feature)}
					on:mouseenter={() => handleMouseEnter(feature)}
					on:mouseleave={() => handleMouseLeave(feature)}
					on:click={() => handleMouseClick(feature)}
				/>
			{/each}

			<!-- countriesWithExtraInfo added for the  -->
			{#each countriesWithExtraInfo.features as feature, index}
				<!-- svelte-ignore a11y_click_events_have_key_events -->
				<path
					d={path(feature)}
					stroke={getStroke(feature)}
					fill={getFill(feature)}
					class={mapConfig.datasetType == 'values'
						? 'country-extra-info-values'
						: 'country-extra-info-binary'}
					on:mouseenter={() => handleMouseEnter(feature)}
					on:mouseleave={() => handleMouseLeave(feature)}
					on:click={() => handleMouseClick(feature)}
					on:touchstart={() => handleTouchStart(feature)}
				/>
			{/each}
		</svg>

		<CountryInfo
			selectedCountry={$selectedCountry}
			countryName={selectedCountryNameTranslated}
			countryText={selectedCountryExtraInfoTextTranslated}
			countryLink={selectedCountryExtraInfoLinkTranslated}
			{tooltip}
		/>

		<!-- only show tooltip for countries with no extraInfo -->
		<!-- {#if $MOUSE.tooltip.extraInfo == false} -->
		<div
			class="tooltip p-3 text-sm {tooltipVisible ? 'active' : ''}"
			style="top: {$MOUSE.y - tooltipHeight}px; left:{tooltipPositionX}px;"
			bind:clientHeight={tooltipHeight}
			bind:clientWidth={tooltipWidth}
		>
			<div class="tooltip-head font-bold">{$MOUSE.tooltip.name}</div>
			<div class="tooltip-body space-y-1">
				{#each tooltip as tip}
					{#if mapConfig.datasetType == 'values'}
						<div class="values">
							{#if mapConfig.datasetUnit == 'percent'}
								{#if mapConfig.percentRounded == true}
									<span class="font-bold">{formatInt($MOUSE.tooltip.value * 100)}%</span>
								{:else if mapConfig.percentRounded == false}
									<span class="font-bold">{Math.round($MOUSE.tooltip.value * 1000) / 10}%</span>
								{/if}
							{:else if mapConfig.datasetUnit == 'fullNumbers'}
								<span class="font-bold">{$MOUSE.tooltip.value}</span>
							{/if}
							<span>{tip.label}</span>
						</div>
					{/if}
					{#if $MOUSE.tooltip.extraInfo == true}
						<div class="text-xs"><span class="icon-tap" />{tooltip[0].textCountryClick}</div>
					{/if}
				{/each}
			</div>
		</div>

		<!-- {/if} -->
	</div>
{/if}

<style>
	#map {
		position: relative;
	}

	/* svg {
		width: 100%;
		height: auto;
	} */
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
		/* stroke-width: 1px; */
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
