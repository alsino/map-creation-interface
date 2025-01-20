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

		// Save URL map
		await put('languages/url-map.json', JSON.stringify(urlMap), {
			contentType: 'application/json',
			access: 'public'
		});

		return json({
			status: 'success',
			urlMap
		});
	} catch (error) {
		console.error('Error saving translations:', error);
		return json({ error: error.message }, { status: 500 });
	}
}
