import { json } from '@sveltejs/kit';
import { v2 } from '@google-cloud/translate';
import { env } from '$env/dynamic/private';
import { put } from '@vercel/blob';

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

async function saveTranslationToBlobStorage(lang, content) {
	try {
		const blob = await put(`languages/${lang}.json`, JSON.stringify(content), {
			contentType: 'application/json',
			access: 'public'
		});
		console.log(`Saved translation for ${lang} to blob storage`);
		return blob.url;
	} catch (error) {
		console.error(`Failed to save translation for ${lang} to blob:`, error);
		throw error;
	}
}

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
		const { sourceObject, batchIndex = 0 } = await request.json();

		if (!sourceObject || Object.keys(sourceObject).length === 0) {
			throw new Error('No content to translate');
		}

		const BATCH_SIZE = 4;
		const totalBatches = Math.ceil(languages.length / BATCH_SIZE);
		const start = batchIndex * BATCH_SIZE;
		const end = Math.min(start + BATCH_SIZE, languages.length);
		const batch = languages.slice(start, end);

		const allErrors = [];
		const results = [];
		const translations = {};
		const blobUrls = {};

		// Process the current batch
		const batchPromises = batch.map(async (item) => {
			try {
				const { translatedObject, errors } = await translateJSON(
					sourceObject,
					item.value,
					item.label
				);

				// Save to translations object
				translations[item.value] = translatedObject;

				// Save to blob storage
				const blobUrl = await saveTranslationToBlobStorage(item.value, translatedObject);
				blobUrls[item.value] = blobUrl;

				if (errors.length > 0) {
					allErrors.push(...errors);
				}

				results.push(item.label);
			} catch (error) {
				allErrors.push(`Failed processing ${item.label}: ${error.message}`);
			}
		});

		await Promise.all(batchPromises);

		const isLastBatch = end >= languages.length;

		return json({
			success: true,
			batchIndex,
			totalBatches,
			completedLanguages: results,
			translations,
			blobUrls, // Include blob URLs in response
			errors: allErrors,
			hasMore: !isLastBatch,
			type: isLastBatch ? 'complete' : 'batchComplete',
			message: isLastBatch
				? allErrors.length > 0
					? 'Translations completed with some issues'
					: 'All translations completed successfully'
				: `Batch ${batchIndex + 1}/${totalBatches} completed`
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
