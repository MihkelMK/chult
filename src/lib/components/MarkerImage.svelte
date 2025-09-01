<script lang="ts">
	interface Props {
		campaignSlug: string;
		markerId: number;
		variant?: 'thumbnail' | 'small' | 'medium' | 'large' | 'popup' | 'modal';
		alt?: string;
		class?: string;
		loading?: 'lazy' | 'eager';
		onLoad?: (imageElement: HTMLImageElement) => void;
		onError?: () => void;
		noImageSlot?: any;
	}

	let {
		campaignSlug,
		markerId,
		variant = 'medium',
		alt = 'Marker image',
		class: className = '',
		loading = 'lazy',
		onLoad,
		onError,
		noImageSlot
	}: Props = $props();

	let markerImageUrls = $state<any | null>(null);
	let imageLoading = $state(true);
	let imageError = $state(false);
	let urlsLoading = $state(true);
	let imageElement: HTMLImageElement | undefined = $state();

	async function loadMarkerImageUrls() {
		try {
			const response = await fetch(`/api/campaigns/${campaignSlug}/markers/${markerId}/image-urls`);

			if (!response.ok) {
				if (response.status === 404) {
					// No image exists for this marker
					imageError = false;
					markerImageUrls = null;
				} else {
					throw new Error('Failed to load marker image URLs');
				}
			} else {
				const data = await response.json();
				markerImageUrls = data;
			}
		} catch (error) {
			console.error('Failed to load marker image URLs:', error);
			imageError = true;
		} finally {
			urlsLoading = false;
		}
	}

	function handleImageLoad() {
		imageLoading = false;
		if (imageElement) {
			onLoad?.(imageElement);
		}
	}

	function handleImageError() {
		imageLoading = false;
		imageError = true;
		onError?.();
	}

	// Load URLs when component mounts or IDs change
	$effect(() => {
		if (campaignSlug && markerId) {
			loadMarkerImageUrls();
		}
	});

	// Get the URL for the current variant
	let imageUrl = $derived(markerImageUrls?.variants?.[variant] || markerImageUrls?.src || null);
</script>

{#if urlsLoading}
	<div class="flex h-full w-full items-center justify-center bg-gray-100 {className}">
		<div
			class="h-6 w-6 animate-spin rounded-full border-2 border-blue-600 border-t-transparent"
		></div>
	</div>
{:else if !markerImageUrls || !imageUrl}
	<!-- No image available - show placeholder or nothing -->
	{@render noImageSlot?.()}
{:else}
	<img
		bind:this={imageElement}
		src={imageUrl}
		{alt}
		class="object-cover {className}"
		{loading}
		onload={handleImageLoad}
		onerror={handleImageError}
	/>

	{#if imageLoading}
		<div class="absolute inset-0 flex items-center justify-center bg-gray-100">
			<div
				class="h-6 w-6 animate-spin rounded-full border-2 border-blue-600 border-t-transparent"
			></div>
		</div>
	{/if}

	{#if imageError}
		<div class="absolute inset-0 flex items-center justify-center bg-red-100 text-red-600">
			<span class="text-sm">Failed to load image</span>
		</div>
	{/if}
{/if}
