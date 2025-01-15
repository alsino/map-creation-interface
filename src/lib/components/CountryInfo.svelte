<script>
	import { fly } from 'svelte/transition';
	import { countryInfoVisible } from '$lib/stores/shared';
	import CountryMediaComponent from './CountryMediaComponent.svelte';
	import { MOUSE } from '$lib/stores/shared';
	import { APP_HEIGHT, mobileSize, isMobile } from '$lib/stores/shared';

	import { formatInt } from '$lib/utils/formatNumbers';

	export let selectedCountry;
	export let countryName;
	export let countryText;
	export let countryLink;
	export let tooltip = [{ label: '' }];
	export let mapConfig;

	let width, height;
	let countryValue;
	let duration = 1000;

	// $: infoBoxPositionX = $MOUSE.x < $MAP_WIDTH / 2 ? $MOUSE.x : $MOUSE.x - width;

	// $: countryValue =
	// 	config.datasetUnit == 'percent' ? formatInt($MOUSE.tooltip.value * 100) : $MOUSE.tooltip.value;
	$: if (selectedCountry) {
		countryValue =
			mapConfig.datasetUnit == 'percent'
				? formatInt(selectedCountry.csvImport.value * 100)
				: selectedCountry.csvImport.value;
		// console.log(countryValue)
	}

	$: countryUnit = mapConfig.datasetUnit == 'percent' ? '%' : '';
	$: countryLabel = tooltip && tooltip[0] ? tooltip[0].label : '';

	// $: console.log('mapConfig', mapConfig);
</script>

{#if $countryInfoVisible}
	<div
		class="country-info absolute overflow-auto rounded border bg-white p-5 text-sm shadow-xl"
		bind:clientWidth={width}
		bind:clientHeight={height}
		in:fly={{ y: $APP_HEIGHT / 2, duration: duration, opacity: 1 }}
		out:fly={{ y: $APP_HEIGHT / 2, duration: duration, opacity: 1 }}
	>
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<!-- svelte-ignore element_invalid_self_closing_tag -->
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div
			class="icon-close static cursor-pointer text-right transition-all"
			on:click={() => {
				$countryInfoVisible = false;
			}}
		/>
		<div class="border-b pb-2">
			<span class="font-bold">{countryName}</span>
			{#if mapConfig.datasetType == 'values'}
				{#if $MOUSE.tooltip.value}
					<span>–</span>
					<span class="font-bold">{countryValue}{countryUnit}</span> <span>{countryLabel}</span>
				{/if}
			{/if}
		</div>

		<CountryMediaComponent {selectedCountry} {countryLink} {mapConfig} />
	</div>
{/if}

<style>
	.country-info {
		width: 100%;
		max-height: 50%;
		z-index: 1;
		bottom: 0;
	}

	.icon-close {
		transition: all 0.2s;
	}

	.icon-close:hover {
		color: #51a665;
	}
</style>
