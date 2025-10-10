export interface ImageVariantData {
	url: string;
	width: number;
}

export interface ImageVariants {
	overview: ImageVariantData;
	large: ImageVariantData;
	detail: ImageVariantData;
	retina: ImageVariantData;
}

export type ImageVariant = keyof ImageVariants;

export interface MapUrlsResponse {
	variants: ImageVariants;
}

export interface ImageOptions {
	width?: number;
	height?: number;
	quality?: number;
	format?: 'webp' | 'jpeg' | 'png' | 'avif';
	dpr?: number;
	preset?: 'thumbnail' | 'small' | 'medium' | 'large';
	gravity?: 'no' | 'so' | 'ea' | 'we' | 'nowe' | 'nowe' | 'soea' | 'sowe' | 'ce' | 'sm';
}
