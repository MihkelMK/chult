import { IMGPROXY_KEY, IMGPROXY_SALT, IMGPROXY_URL } from '$env/static/private';
import type { ImageOptions, ImageVariants, ResponsiveImageData } from '$lib/types';
import crypto from 'crypto';

function sign(target: string): string {
	const hmac = crypto.createHmac('sha256', Buffer.from(IMGPROXY_KEY, 'hex'));
	hmac.update(Buffer.from(IMGPROXY_SALT, 'hex'));
	hmac.update(target);

	return hmac.digest('base64url');
}

export function generateMapUrl(campaignSlug: string, options: ImageOptions = {}): string {
	// Use preset if specified
	if (options.preset) {
		const sourceUrl = `local:///${campaignSlug}/map.jpg`;
		const encodedUrl = Buffer.from(sourceUrl).toString('base64url');
		const target = `/preset:${options.preset}/${encodedUrl}`;
		const signature = sign(target);

		return `${IMGPROXY_URL}/${signature}${target}`;
	}

	// Build custom processing options
	const {
		width = 0, // 0 = auto
		height = 0,
		quality = 85,
		format = 'webp',
		dpr = 1,
		gravity = 'ce' // center
	} = options;

	const sourceUrl = `local:///${campaignSlug}/map.jpg`;
	const encodedUrl = Buffer.from(sourceUrl).toString('base64url');

	// Build processing pipeline - each option is a separate segment
	const processingSegments = [];

	// Resize (required)
	if (width > 0 || height > 0) {
		processingSegments.push(`resize:fit:${width}:${height}:0`); // 0 = don't enlarge
	}

	// Gravity
	if (gravity) {
		processingSegments.push(`gravity:${gravity}`);
	}

	// Quality
	if (quality !== 85) {
		// Only add if not default
		processingSegments.push(`quality:${quality}`);
	}

	// Format
	if (format !== 'webp') {
		// Only add if not default
		processingSegments.push(`format:${format}`);
	}

	// DPR
	if (dpr !== 1) {
		// Only add if not default
		processingSegments.push(`dpr:${dpr}`);
	}

	const processingPath = processingSegments.length > 0 ? '/' + processingSegments.join('/') : '';

	const target = `${processingPath}/${encodedUrl}`;
	const signature = sign(target);

	return `${IMGPROXY_URL}/${signature}${target}`;
}

export function generateMarkerImageUrl(
	campaignSlug: string,
	markerId: number,
	options: ImageOptions = {}
): string {
	// Use preset if specified
	if (options.preset) {
		const sourceUrl = `local:///${campaignSlug}/markers/${markerId}.jpg`;
		const encodedUrl = Buffer.from(sourceUrl).toString('base64url');
		const target = `/preset:${options.preset}/${encodedUrl}`;
		const signature = sign(target);

		return `${IMGPROXY_URL}/${signature}${target}`;
	}

	// Build custom processing options
	const {
		width = 0, // 0 = auto
		height = 0,
		quality = 85,
		format = 'webp',
		dpr = 1,
		gravity = 'ce' // center
	} = options;

	const sourceUrl = `local:///${campaignSlug}/markers/${markerId}.jpg`;
	const encodedUrl = Buffer.from(sourceUrl).toString('base64url');

	// Build processing pipeline - each option is a separate segment
	const processingSegments = [];

	// Resize (required)
	if (width > 0 || height > 0) {
		processingSegments.push(`resize:fit:${width}:${height}:0`); // 0 = don't enlarge
	}

	// Gravity
	if (gravity) {
		processingSegments.push(`gravity:${gravity}`);
	}

	// Quality
	if (quality !== 85) {
		// Only add if not default
		processingSegments.push(`quality:${quality}`);
	}

	// Format
	if (format !== 'webp') {
		// Only add if not default
		processingSegments.push(`format:${format}`);
	}

	// DPR
	if (dpr !== 1) {
		// Only add if not default
		processingSegments.push(`dpr:${dpr}`);
	}

	const processingPath = processingSegments.length > 0 ? '/' + processingSegments.join('/') : '';

	const target = `${processingPath}/${encodedUrl}`;
	const signature = sign(target);

	return `${IMGPROXY_URL}/${signature}${target}`;
}

export function generateMapVariants(campaignSlug: string): ImageVariants {
	return {
		thumbnail: generateMapUrl(campaignSlug, { preset: 'thumbnail' }),
		small: generateMapUrl(campaignSlug, { preset: 'small' }),
		medium: generateMapUrl(campaignSlug, { preset: 'medium' }),
		large: generateMapUrl(campaignSlug, { preset: 'large' }),

		// Custom sizes for specific D&D use cases
		hexGrid: generateMapUrl(campaignSlug, {
			width: 1920,
			height: 1920,
			quality: 90,
			format: 'webp'
		}),
		overview: generateMapUrl(campaignSlug, {
			width: 800,
			quality: 75,
			format: 'webp'
		}),
		detail: generateMapUrl(campaignSlug, {
			width: 2560,
			quality: 95,
			format: 'webp'
		}),

		// Mobile optimized
		mobile: generateMapUrl(campaignSlug, {
			width: 800,
			quality: 70,
			format: 'webp'
		}),

		// Retina displays
		retina: generateMapUrl(campaignSlug, {
			width: 1920,
			dpr: 2,
			quality: 85,
			format: 'webp'
		})
	};
}

export function generateMarkerImageVariants(campaignSlug: string, markerId: number) {
	return {
		thumbnail: generateMarkerImageUrl(campaignSlug, markerId, {
			width: 120,
			height: 120,
			quality: 80
		}),
		small: generateMarkerImageUrl(campaignSlug, markerId, { width: 240, height: 240, quality: 85 }),
		medium: generateMarkerImageUrl(campaignSlug, markerId, {
			width: 480,
			height: 480,
			quality: 90
		}),
		large: generateMarkerImageUrl(campaignSlug, markerId, { width: 800, height: 800, quality: 95 }),
		popup: generateMarkerImageUrl(campaignSlug, markerId, { width: 300, height: 200, quality: 85 }), // For hover popups
		modal: generateMarkerImageUrl(campaignSlug, markerId, { width: 600, height: 400, quality: 90 }) // For modals
	};
}

// Utility to check if map exists before generating URLs
export async function hasMapImage(campaignSlug: string): Promise<boolean> {
	const { existsSync } = await import('fs');
	const path = await import('path');
	const mapPath = path.join('./uploads', campaignSlug, 'map.jpg');
	return existsSync(mapPath);
}

// Utility to check if marker image exists before generating URLs
export async function hasMarkerImage(campaignSlug: string, markerId: number): Promise<boolean> {
	const { existsSync } = await import('fs');
	const path = await import('path');
	const markerPath = path.join('./uploads', campaignSlug, 'markers', `${markerId}.jpg`);
	return existsSync(markerPath);
}

// Generate a responsive srcset for the map
export function generateMapSrcSet(campaignSlug: string): ResponsiveImageData {
	const variants = generateMapVariants(campaignSlug);

	return {
		src: variants.medium, // Default fallback
		srcset: [
			`${variants.small} 800w`,
			`${variants.medium} 1280w`,
			`${variants.large} 1920w`,
			`${variants.detail} 2560w`
		].join(', '),
		sizes:
			'(max-width: 768px) 800px, (max-width: 1200px) 1280px, (max-width: 1600px) 1920px, 2560px'
	};
}
