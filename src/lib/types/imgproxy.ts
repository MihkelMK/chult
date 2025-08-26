export interface ImageVariants {
	thumbnail: string;
	small: string;
	medium: string;
	large: string;
	hexGrid: string;
	overview: string;
	detail: string;
	mobile: string;
	retina: string;
}

export interface ResponsiveImageData {
	src: string;
	srcset: string;
	sizes: string;
}

export interface MapUrlsResponse {
	variants: ImageVariants;
	responsive: ResponsiveImageData;
	timestamp: number;
}

export type ImageVariant = keyof ImageVariants | 'responsive';

export interface ImageOptions {
	width?: number;
	height?: number;
	quality?: number;
	format?: 'webp' | 'jpeg' | 'png' | 'avif';
	dpr?: number;
	preset?: 'thumbnail' | 'small' | 'medium' | 'large';
	gravity?: 'no' | 'so' | 'ea' | 'we' | 'nowe' | 'nowe' | 'soea' | 'sowe' | 'ce' | 'sm';
}
