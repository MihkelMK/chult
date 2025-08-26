<script lang="ts">
	import type { ImageVariant, MapUrlsResponse } from '$lib/types';

	interface Props {
		campaignSlug: string;
		variant?: ImageVariant;
		alt?: string;
		class?: string;
		loading?: 'lazy' | 'eager';
		onLoad?: (imageElement: HTMLImageElement) => void;
		onError?: () => void;
	}

	let {
		campaignSlug,
		variant = 'medium',
		alt = 'Campaign map',
		class: className = '',
		loading = 'lazy',
		onLoad,
		onError
	}: Props = $props();

	let mapUrls = $state<MapUrlsResponse | null>(null);
	let imageLoading = $state(true);
	let imageError = $state(false);
	let urlsLoading = $state(true);
	let imageElement: HTMLImageElement | undefined = $state();

	async function loadMapUrls() {
		try {
			const response = await fetch(`/api/campaigns/${campaignSlug}/map/urls`);

			if (!response.ok) {
				throw new Error('Failed to load map URLs');
			}

			const data = await response.json();
			mapUrls = data;
		} catch (error) {
			console.error('Failed to load map URLs:', error);
			imageError = true;
		} finally {
			urlsLoading = false;
		}
	}

	function handleImageLoad() {
		imageLoading = false;
		if (imageElement) {
			onLoad?.(imageElement); // Pass the image element
		}
	}

	function handleImageError() {
		imageError = true;
		imageLoading = false;
		onError?.();
	}

	// Get the correct URL based on variant
	let imageUrl = $derived.by(() => {
		if (!mapUrls) return '';

		if (variant === 'responsive') {
			return mapUrls.responsive.src;
		}

		return mapUrls.variants[variant];
	});

	let imageSrcSet = $derived.by(() => {
		if (!mapUrls || variant !== 'responsive') return undefined;
		return mapUrls.responsive.srcset;
	});

	let imageSizes = $derived.by(() => {
		if (!mapUrls || variant !== 'responsive') return undefined;
		return mapUrls.responsive.sizes;
	});

	$effect(() => {
		loadMapUrls();
	});
</script>

{#if urlsLoading}
	<div class="animate-pulse rounded-lg bg-gray-200 {className}" style="aspect-ratio: 1;">
		<div class="flex h-full items-center justify-center">
			<svg class="h-8 w-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
				/>
			</svg>
		</div>
	</div>
{:else if imageError || !mapUrls}
	<div class="rounded-lg border-2 border-dashed border-gray-300 bg-gray-100 {className}">
		<div class="flex h-full flex-col items-center justify-center p-8">
			<svg
				class="mb-4 h-12 w-12 text-gray-400"
				fill="none"
				stroke="currentColor"
				viewBox="0 0 24 24"
			>
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.664-.833-2.464 0L4.268 16.5c-.77.833.192 2.5 1.732 2.5z"
				/>
			</svg>
			<p class="text-center text-gray-500">
				{imageError ? 'Failed to load map' : 'No map uploaded'}
			</p>
		</div>
	</div>
{:else}
	<div class="relative {className}">
		<!-- Loading overlay -->
		{#if imageLoading}
			<div
				class="absolute inset-0 z-10 flex animate-pulse items-center justify-center rounded-lg bg-gray-200"
			>
				<svg class="h-8 w-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
					/>
				</svg>
			</div>
		{/if}

		<!-- Optimized image -->
		<img
			bind:this={imageElement}
			src={imageUrl}
			srcset={imageSrcSet}
			sizes={imageSizes}
			{alt}
			{loading}
			decoding="async"
			class="h-auto w-full rounded-lg"
			onload={handleImageLoad}
			onerror={handleImageError}
		/>
	</div>
{/if}
