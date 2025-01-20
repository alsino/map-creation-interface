import { json } from '@sveltejs/kit';

export async function GET({ params }) {
	try {
		const lang = params.lang;
		const response = await fetch(`${process.env.BLOB_READ_URL}/languages/${lang}.json`);

		if (!response.ok) {
			return json({ error: `No translation found for ${lang}` }, { status: 404 });
		}

		const content = await response.json();
		return json(content);
	} catch (error) {
		console.error('Error fetching translation:', error);
		return json({ error: 'Failed to fetch translation' }, { status: 500 });
	}
}
