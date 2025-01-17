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

// async function translateJSON(sourceObject, target, label) {
// 	const translatedObject = {};
// 	const errors = [];

// 	for (const [key, value] of Object.entries(sourceObject)) {
// 		if (value && typeof value === 'string' && value.trim() !== '') {
// 			try {
// 				const [translation] = await googleClient.translate(value, target);
// 				translatedObject[key] = translation.replace(/"/g, "'");
// 			} catch (error) {
// 				errors.push(`Failed to translate ${key} to ${label}: ${error.message}`);
// 				translatedObject[key] = value; // Fallback to original
// 			}
// 		}
// 	}

// 	if (errors.length > 0) {
// 		console.error(`Errors while translating to ${label}:`, errors);
// 	}

// 	return { translatedObject, errors };
// }

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

// function writeJSONToFile(jsonObj, target, label) {
// 	return new Promise((resolve, reject) => {
// 		// Ensure directory exists
// 		const dir = './static/languages';
// 		if (!fs.existsSync(dir)) {
// 			fs.mkdirSync(dir, { recursive: true });
// 		}

// 		const data = JSON.stringify(jsonObj, null, 2);

// 		fs.writeFile(`${dir}/${target}.json`, data, (err) => {
// 			if (err) {
// 				reject(new Error(`Failed to write ${label} translation file: ${err.message}`));
// 				return;
// 			}
// 			resolve();
// 		});
// 	});
// }

// export async function POST({ request }) {
// 	try {
// 		const sourceObject = await request.json();

// 		if (!sourceObject || Object.keys(sourceObject).length === 0) {
// 			throw new Error('No content to translate');
// 		}

// 		console.log('Starting translation process...');

// 		const allErrors = [];
// 		const results = [];

// 		// Translate for all languages sequentially to avoid API rate limits
// 		for (const item of languages) {
// 			try {
// 				const { translatedObject, errors } = await translateJSON(
// 					sourceObject,
// 					item.value,
// 					item.label
// 				);
// 				await writeJSONToFile(translatedObject, item.value, item.label);

// 				if (errors.length > 0) {
// 					allErrors.push(...errors);
// 				}

// 				results.push(item.label);
// 			} catch (error) {
// 				allErrors.push(`Failed processing ${item.label}: ${error.message}`);
// 			}
// 		}

// 		if (allErrors.length > 0) {
// 			// Return partial success with warnings
// 			return json({
// 				success: true,
// 				warning: true,
// 				message: 'Translations completed with some issues',
// 				details: allErrors,
// 				completedLanguages: results
// 			});
// 		}

// 		return json({
// 			success: true,
// 			message: 'All translations completed successfully',
// 			completedLanguages: results
// 		});
// 	} catch (error) {
// 		console.error('Translation error:', error);
// 		return json(
// 			{
// 				success: false,
// 				error: error.message,
// 				details: error.stack
// 			},
// 			{ status: 500 }
// 		);
// 	}
// }

export async function POST({ request }) {
	try {
		const sourceObject = await request.json();

		if (!sourceObject || Object.keys(sourceObject).length === 0) {
			throw new Error('No content to translate');
		}

		const allErrors = [];
		const translations = {}; // Store translations in an object

		for (const item of languages) {
			try {
				const { translatedObject, errors } = await translateJSON(
					sourceObject,
					item.value,
					item.label
				);

				// Store translation in memory
				translations[item.value] = translatedObject;

				if (errors.length > 0) {
					allErrors.push(...errors);
				}
			} catch (error) {
				allErrors.push(`Failed processing ${item.label}: ${error.message}`);
			}
		}

		if (allErrors.length > 0) {
			return json({
				success: true,
				warning: true,
				message: 'Translations completed with some issues',
				details: allErrors,
				translations // Return all translations in the response
			});
		}

		return json({
			success: true,
			message: 'All translations completed successfully',
			translations // Return all translations in the response
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
