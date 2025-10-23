<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Badge } from '$lib/components/ui/badge';
	import { Upload, Image, Trash2, Loader2, CheckCircle, AlertCircle } from '@lucide/svelte';
	import { PUBLIC_MAX_IMAGE_SIZE } from '$env/static/public';
	import type { MapUrlsResponse } from '$lib/types';

	interface Props {
		mapUrls?: MapUrlsResponse;
		campaignSlug: string;
		onMapUploaded?: () => void;
	}

	let { mapUrls, campaignSlug, onMapUploaded }: Props = $props();

	// Upload state
	let fileInput: HTMLInputElement;
	let dragActive = $state(false);
	let uploading = $state(false);
	let uploadError = $state('');
	let uploadSuccess = $state('');
	let previewUrl = $state('');
	let showUploadInterface = $state(!mapUrls);
	let mapExists = $state(mapUrls || false);

	function handleFileSelect(file: File) {
		if (!file) return;

		// Reset states
		uploadError = '';
		uploadSuccess = '';

		// Validate file
		if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
			uploadError = 'Please select a JPEG, PNG, or WebP image';
			return;
		}

		if (file.size > Number(PUBLIC_MAX_IMAGE_SIZE)) {
			uploadError = 'File size must be less than 50MB';
			return;
		}

		// Show preview
		const reader = new FileReader();
		reader.onload = (e) => {
			previewUrl = e.target?.result as string;
		};
		reader.readAsDataURL(file);

		// Start upload
		uploadFile(file);
	}

	async function uploadFile(file: File) {
		uploading = true;
		uploadError = '';
		uploadSuccess = '';

		try {
			const formData = new FormData();
			formData.append('map', file);

			const response = await fetch(`/api/campaigns/${campaignSlug}/map/upload`, {
				method: 'POST',
				body: formData
			});

			const result = await response.json();

			if (!response.ok) {
				throw new Error(result.message || 'Upload failed');
			}

			// Success!
			let message = 'Map uploaded successfully!';
			if (result.wasResized) {
				message += ` Resized from ${result.originalDimensions?.width}×${result.originalDimensions?.height} to ${result.finalDimensions?.width}×${result.finalDimensions?.height} for optimal processing.`;
			}

			uploadSuccess = message;
			mapExists = true;
			showUploadInterface = false;

			// Clear preview
			setTimeout(() => {
				previewUrl = '';
			}, 2000);

			onMapUploaded?.();
		} catch (error) {
			uploadError = error instanceof Error ? error.message : 'Upload failed';
			previewUrl = '';
		} finally {
			uploading = false;
		}
	}

	async function deleteExistingMap() {
		if (!confirm('Are you sure you want to delete the current map? This cannot be undone.')) {
			return;
		}

		try {
			const response = await fetch(`/api/campaigns/${campaignSlug}/map/upload`, {
				method: 'DELETE'
			});

			if (response.ok) {
				mapExists = false;
				showUploadInterface = true;
				uploadSuccess = 'Map deleted successfully';
				onMapUploaded?.(); // Refresh parent
			} else {
				uploadError = 'Failed to delete map';
			}
		} catch {
			uploadError = 'Failed to delete map';
		}
	}

	// Drag and drop handlers
	function handleDrop(e: DragEvent) {
		e.preventDefault();
		dragActive = false;

		const files = e.dataTransfer?.files;
		if (files && files.length > 0) {
			handleFileSelect(files[0]);
		}
	}

	function handleDragOver(e: DragEvent) {
		e.preventDefault();
		dragActive = true;
	}

	function handleDragLeave(e: DragEvent) {
		e.preventDefault();
		dragActive = false;
	}
</script>

<div class="space-y-4">
	<!-- Status Messages -->
	{#if uploadError}
		<div class="flex gap-2 items-center p-3 text-sm rounded-md bg-destructive/15 text-destructive">
			<AlertCircle class="w-4 h-4" />
			<span>{uploadError}</span>
		</div>
	{/if}

	{#if uploadSuccess}
		<div class="flex gap-2 items-center p-3 text-sm text-green-800 bg-green-50 rounded-md">
			<CheckCircle class="w-4 h-4" />
			<div>
				<p class="font-medium">Success!</p>
				<p class="text-xs opacity-90">{uploadSuccess}</p>
			</div>
		</div>
	{/if}

	<!-- Map Status -->
	{#if mapExists && !showUploadInterface}
		<div class="flex justify-between items-center rounded-lg">
			<div class="flex gap-3 items-center">
				<div class="flex justify-center items-center w-10 h-10 bg-green-100 rounded-full">
					<Image class="w-5 h-5 text-green-600" />
				</div>
				<div>
					<p class="font-medium">Map Uploaded</p>
					<p class="text-sm text-muted-foreground">Ready for campaign use</p>
				</div>
			</div>
			<div class="flex gap-2">
				<Button variant="outline" size="sm" onclick={() => (showUploadInterface = true)}>
					Replace
				</Button>
				<Button variant="outline" size="sm" onclick={deleteExistingMap}>
					<Trash2 class="w-4 h-4" />
				</Button>
			</div>
		</div>
	{/if}

	<!-- Upload Interface -->
	{#if showUploadInterface || !mapExists}
		<div>
			<div>
				{#if mapExists}
					<div class="flex justify-between items-center mb-4">
						<h4 class="font-medium">Replace Map</h4>
						<Button variant="ghost" size="sm" onclick={() => (showUploadInterface = false)}>
							Cancel
						</Button>
					</div>
				{/if}

				<!-- Upload Area -->
				<!-- svelte-ignore a11y_no_static_element_interactions -->
				<div
					class="rounded-lg border-2 border-dashed p-6 text-center transition-colors {dragActive
						? 'border-primary bg-primary/5'
						: uploading
							? 'border-muted-foreground/50 bg-muted/50'
							: 'border-muted-foreground/25 hover:border-muted-foreground/50'}"
					ondrop={handleDrop}
					ondragover={handleDragOver}
					ondragleave={handleDragLeave}
				>
					{#if uploading}
						<div class="py-6">
							<Loader2 class="mx-auto mb-3 w-8 h-8 animate-spin text-primary" />
							<p class="text-sm font-medium">Processing map...</p>
							<p class="mt-1 text-xs text-muted-foreground">
								Large maps may take a moment to optimize
							</p>
						</div>
					{:else if previewUrl}
						<div class="space-y-3">
							<img src={previewUrl} alt="Map preview" class="mx-auto max-h-32 rounded border" />
							<Badge variant="secondary">Upload in progress...</Badge>
						</div>
					{:else}
						<div class="space-y-4">
							<Upload class="mx-auto w-12 h-12 text-muted-foreground" />
							<div>
								<p class="mb-2 font-medium">Drop your D&D map here</p>
								<p class="mb-4 text-sm text-muted-foreground">or click to browse files</p>
								<Button onclick={() => fileInput.click()}>
									<Upload class="mr-2 w-4 h-4" />
									Choose Map File
								</Button>
							</div>
							<div class="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
								<p>Max 50MB</p>
								<p>JPEG, PNG, WebP</p>
							</div>
						</div>
					{/if}
				</div>
			</div>
		</div>
	{/if}

	<!-- Hidden file input -->
	<input
		bind:this={fileInput}
		type="file"
		accept="image/jpeg,image/png,image/webp"
		onchange={(e) => {
			const file = e.currentTarget.files?.[0];
			if (file) handleFileSelect(file);
		}}
		class="hidden"
	/>
</div>
