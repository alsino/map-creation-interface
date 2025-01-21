// /api/cleanup-storage.js
import { json } from '@sveltejs/kit';
import { del, list } from '@vercel/blob';

export async function POST({ request }) {
	try {
		console.log('Starting blob storage cleanup...');
		const { blobs } = await list();
		console.log(`Found ${blobs.length} files in blob storage`);

		for (const blob of blobs) {
			try {
				await del(blob.url);
				console.log(`Deleted blob: ${blob.url}`);
			} catch (error) {
				console.error(`Failed to delete blob: ${blob.url}`, error);
				throw error;
			}
		}

		// Verify cleanup
		const { blobs: remainingBlobs } = await list();
		console.log(`Cleanup completed. ${remainingBlobs.length} blobs remaining.`);

		return json({
			status: 'success',
			message: 'Blob storage cleaned up successfully',
			remainingBlobs: remainingBlobs.length
		});
	} catch (error) {
		console.error('Error during blob storage cleanup:', error);
		return json(
			{
				error: error.message || 'Failed to clean up blob storage',
				status: 'error'
			},
			{ status: error.status || 500 }
		);
	}
}
