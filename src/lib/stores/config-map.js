import { writable } from 'svelte/store';

export const mapConfig = writable({
	title: '[This is the map title]',
	subtitle: '[This is the map subtitle]',
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
	textSource: '',
	textNoteAvailable: true,
	textNote: '',
	textDataAccessAvailable: true,
	linkDataAccess: '',
	legend1Color: '#E0E0E0',
	legend2Color: 'red',
	legend3Color: 'blue',
	legend4Color: 'green',
	parsedData: null,
	data: ``,
	customUnitLabelAvailable: false,
	customUnitLabel: undefined
});
