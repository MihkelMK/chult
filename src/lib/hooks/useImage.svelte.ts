import type { CanvasImage } from '$lib/types';

export default function useImage(
	url: string,
	crossOrigin = null,
	referrerPolicy = null
): () => CanvasImage {
	// Usage:
	// const imageLoader = useImage('https://example.com/image.jpg');

	// Access with:
	// imageLoader().image
	// imageLoader().status
	let image: HTMLImageElement | undefined = $state(undefined);
	let status: 'loading' | 'loaded' | 'failed' = $state('loading');

	$effect(() => {
		if (!url) return;

		status = 'loading';
		image = undefined;

		const img = document.createElement('img');

		function onload() {
			img
				.decode()
				.catch(() => {
					// Ignore decode errors - image can still render on canvas
				})
				.finally(() => {
					status = 'loaded';
					image = img;
				});
		}

		function onerror() {
			status = 'failed';
			image = undefined;
		}

		img.addEventListener('load', onload);
		img.addEventListener('error', onerror);
		if (crossOrigin) img.crossOrigin = crossOrigin;
		if (referrerPolicy) img.referrerPolicy = referrerPolicy;
		img.src = url;

		return () => {
			img.removeEventListener('load', onload);
			img.removeEventListener('error', onerror);
		};
	});

	return () => ({ image, status });
}
