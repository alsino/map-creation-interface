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
		console.log(`Processing ${languages.length} languages`);

		// Generate a reference ID
		const referenceId = `trans_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

		// Save translations in batches
		for (let i = 0; i < languages.length; i += BATCH_SIZE) {
			const batch = languages.slice(i, Math.min(i + BATCH_SIZE, languages.length));
			console.log(
				`Processing batch ${i / BATCH_SIZE + 1} of ${Math.ceil(languages.length / BATCH_SIZE)}`
			);

			await Promise.all(
				batch.map(async (lang) => {
					try {
						const blob = await put(
							`translations/${referenceId}/${lang}.json`,
							JSON.stringify(translations[lang], null, 2),
							{
								contentType: 'application/json',
								access: 'public'
							}
						);
						urlMap[lang] = blob.url;
						console.log(`Saved ${lang} translation to ${blob.url}`);
					} catch (error) {
						console.error(`Error saving translation for ${lang}:`, error);
						throw error;
					}
				})
			);
		}

		// Save URL map
		const mapBlob = await put(`references/${referenceId}.json`, JSON.stringify(urlMap, null, 2), {
			contentType: 'application/json',
			access: 'public'
		});

		console.log(`Saved reference map to ${mapBlob.url}`);

		return json({
			status: 'success',
			referenceId,
			referenceUrl: mapBlob.url,
			languageCount: languages.length
		});
	} catch (error) {
		console.error('Error saving translations:', error);
		return json(
			{
				error: error.message,
				status: 'error'
			},
			{ status: 500 }
		);
	}
}
