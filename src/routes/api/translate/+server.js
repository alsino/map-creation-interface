// import { json } from '@sveltejs/kit';
// import { v2 } from '@google-cloud/translate';
// import * as fs from 'fs';
// import { env } from '$env/dynamic/private';

// const { Translate } = v2;
// const googleClient = new Translate({ key: env.GOOGLE_API_KEY });

import { json } from '@sveltejs/kit';
import { v2 } from '@google-cloud/translate';
import { env } from '$env/dynamic/private';

const { Translate } = v2;
const googleClient = new Translate({ key: env.GOOGLE_API_KEY });

const languages = [
	{ value: 'bg', label: 'Bulgarian' },
	{ value: 'hr', label: 'Croatian' },
	{ value: 'cs', label: 'Czech' },
	{ value: 'da', label: 'Danish' },
	{ value: 'nl', label: 'Dutch' },
	{ value: 'en', label: 'English' },
	{ value: 'et', label: 'Estonian' },
	{ value: 'fi', label: 'Finnish' },
	{ value: 'fr', label: 'French' },
	{ value: 'de', label: 'German' },
	{ value: 'el', label: 'Greek' },
	{ value: 'hu', label: 'Hungarian' },
	{ value: 'ga', label: 'Irish' },
	{ value: 'it', label: 'Italian' },
	{ value: 'lv', label: 'Latvian' },
	{ value: 'lt', label: 'Lithuanian' },
	{ value: 'mt', label: 'Maltese' },
	{ value: 'pl', label: 'Polish' },
	{ value: 'pt', label: 'Portuguese' },
	{ value: 'ro', label: 'Romanian' },
	{ value: 'sk', label: 'Slovak' },
	{ value: 'sl', label: 'Slovenian' },
	{ value: 'es', label: 'Spanish' },
	{ value: 'sv', label: 'Swedish' }
];

async function translateJSON(sourceObject, target, label) {
	// Keep this function the same, just remove file operations
	const translatedObject = {};
	const errors = [];

	for (const [key, value] of Object.entries(sourceObject)) {
		if (value && typeof value === 'string' && value.trim() !== '') {
			try {
				const [translation] = await googleClient.translate(value, target);
				translatedObject[key] = translation.replace(/"/g, "'");
			} catch (error) {
				errors.push(`Failed to translate ${key} to ${label}: ${error.message}`);
				translatedObject[key] = value;
			}
		}
	}

	return { translatedObject, errors };
}

export async function POST({ request }) {
	try {
		const sourceObject = await request.json();

		if (!sourceObject || Object.keys(sourceObject).length === 0) {
			throw new Error('No content to translate');
		}

		console.log('Starting translation process...');

		const allErrors = [];
		const results = [];
		const translations = {};
		const BATCH_SIZE = 4; // Process 4 languages at a time

		// Process languages in batches
		for (let i = 0; i < languages.length; i += BATCH_SIZE) {
			console.log(`Processing batch ${i / BATCH_SIZE + 1}`);
			const batch = languages.slice(i, i + BATCH_SIZE);

			// Process each language in the current batch
			const batchPromises = batch.map(async (item) => {
				try {
					const { translatedObject, errors } = await translateJSON(
						sourceObject,
						item.value,
						item.label
					);

					translations[item.value] = translatedObject;

					if (errors.length > 0) {
						allErrors.push(...errors);
					}

					results.push(item.label);
				} catch (error) {
					allErrors.push(`Failed processing ${item.label}: ${error.message}`);
				}
			});

			// Wait for current batch to complete before moving to next batch
			await Promise.all(batchPromises);
		}

		if (allErrors.length > 0) {
			// Return partial success with warnings
			return json({
				success: true,
				warning: true,
				message: 'Translations completed with some issues',
				details: allErrors,
				completedLanguages: results,
				translations
			});
		}

		return json({
			success: true,
			message: 'All translations completed successfully',
			completedLanguages: results,
			translations
		});
	} catch (error) {
		console.error('Translation error:', error);
		return json(
			{
				success: false,
				error: error.message,
				details: error.stack
			},
			{ status: 500 }
		);
	}
}
