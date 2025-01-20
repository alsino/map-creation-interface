import { json } from '@sveltejs/kit';

export async function GET({ params }) {
	try {
		const lang = params.lang;
		// Note: The URL will be returned by the put function when saving
		// We'll need to store these URLs or construct them in a consistent way
		const response = await fetch(`${process.env.NEXT_PUBLIC_BLOB_BASE_URL}/languages/${lang}.json`);

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
