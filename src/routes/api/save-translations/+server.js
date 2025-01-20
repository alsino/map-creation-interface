// src/routes/api/save-translations/+server.js
import { json } from '@sveltejs/kit';
import { put } from '@vercel/blob';

const BATCH_SIZE = 10;

export async function POST({ request }) {
	try {
		const { translations } = await request.json();
		const urlMap = {};

		if (!translations || typeof translations !== 'object') {
			return json({ error: 'Invalid translations format' }, { status: 400 });
		}

		const languages = Object.keys(translations);

		// Save translations in batches
		for (let i = 0; i < languages.length; i += BATCH_SIZE) {
			const batch = languages.slice(i, Math.min(i + BATCH_SIZE, languages.length));

			await Promise.all(
				batch.map(async (lang) => {
					try {
						const blob = await put(`languages/${lang}.json`, JSON.stringify(translations[lang]), {
							contentType: 'application/json',
							access: 'public'
						});
						urlMap[lang] = blob.url;
					} catch (error) {
						console.error(`Error saving translation for ${lang}:`, error);
					}
				})
			);
		}

		// Generate a reference ID using timestamp and random string
		const referenceId = `trans_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

		// Save URL map with reference ID
		await put(`references/${referenceId}.json`, JSON.stringify(urlMap), {
			contentType: 'application/json',
			access: 'public'
		});

		return json({
			status: 'success',
			referenceId,
			languageCount: languages.length
		});
	} catch (error) {
		console.error('Error saving translations:', error);
		return json({ error: error.message }, { status: 500 });
	}
}
