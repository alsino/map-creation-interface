import { writable } from 'svelte/store';
import { browser } from '$app/environment';

export const isFullscreen = writable(false);

// Initialize from localStorage if available
if (browser) {
	const stored = localStorage.getItem('viewMode');
	if (stored) {
		isFullscreen.set(stored === 'fullscreen');
	}
}

// Subscribe to changes and update localStorage
if (browser) {
	isFullscreen.subscribe((value) => {
		localStorage.setItem('viewMode', value ? 'fullscreen' : 'default');
	});
}
