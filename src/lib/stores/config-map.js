import { writable } from 'svelte/store';

export const mapConfig = writable({
	title: 'Which EU countries offer the best employment prospects?',
	subtitle: 'Future employment growth in these countries in 2022-2035 is estimated at 5.6%.',
	datasetType: 'values',
	datasetUnit: 'percent',
	percentRounded: false,
	colourSchemeType: 'sequential',
	colourScheme: 'red',
	colourSchemeClasses: 5,
	colourSchemeReverse: false,
	overrideScaleValues: false,
	colorBarFirstValue: undefined,
	colorBarLastValue: undefined,
	headlineAvailable: true,
	subheadlineAvailable: true,
	tooltipAvailable: true,
	scaleBarAvailable: true,
	legendAvailable: true,
	textSourceAvailable: true,
	textSourceDescription: 'Source',
	textSource: '',
	textNoteAvailable: true,
	textNoteDescription: 'Note',
	textNote: '',
	textDataAccessAvailable: true,
	linkDataAccessDescription: 'Access the data',
	linkDataAccess: '',
	legend1: 'No data available',
	legend1Color: '#E0E0E0',
	tooltipExtraInfoLabel: '',
	parsedData: null,
	data: ``,
	customUnitLabelAvailable: false,
	customUnitLabel: undefined
});

export const shouldUpdateMap = writable(true);
