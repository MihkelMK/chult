<script lang="ts">
	import { PUBLIC_MAX_IMAGE_SIZE } from '$env/static/public';
	import ConfirmDialog from '$lib/components/dialogs/ConfirmDialog.svelte';
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import type { UserRole } from '$lib/types';
	import { Image, LoaderCircle, Trash2, Upload } from '@lucide/svelte';
	import { onMount } from 'svelte';
	import { toast } from 'svelte-sonner';

	interface Props {
		mapExists: boolean;
		campaignSlug: string;
		onMapUploaded?: () => void;
		onDeleted?: () => void;
		mapType?: UserRole;
		label?: string;
	}

	let {
		mapExists,
		campaignSlug,
		onMapUploaded,
		onDeleted,
		mapType = 'dm',
		label
	}: Props = $props();

	// Upload state
	let fileInput: HTMLInputElement;
	let dragActive = $state(false);
	let uploading = $state(false);
	let previewUrl = $state('');
	let showUploadInterface = $state(true);

	// Dialog state
	let confirmDeleteDialogOpen = $state(false);

	function handleFileSelect(file: File) {
		if (!file) return;

		// Validate file
		if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
			toast.error('Invalid file type', {
				description: 'Please select a JPEG, PNG, or WebP image'
			});
			return;
		}

		if (file.size > Number(PUBLIC_MAX_IMAGE_SIZE)) {
			toast.error('File too large', {
				description: 'File size must be less than 50MB'
			});
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

		try {
			const formData = new FormData();
			formData.append('map', file);

			const url = `/api/campaigns/${campaignSlug}/map/upload${mapType === 'player' ? '?mapType=player' : ''}`;
			const response = await fetch(url, {
				method: 'POST',
				body: formData
			});

			const result = await response.json();

			if (!response.ok) {
				throw new Error(result.message || 'Upload failed');
			}

			// Success!
			const mapLabel = label || (mapType === 'player' ? 'Player map' : 'Map');
			let message = `${mapLabel} uploaded successfully!`;
			if (result.wasResized) {
				message = `Resized from ${result.originalDimensions?.width}×${result.originalDimensions?.height} to ${result.finalDimensions?.width}×${result.finalDimensions?.height} for optimal processing.`;
			}

			toast.success('Upload successful', {
				description: message
			});

			showUploadInterface = false;

			// Clear preview
			setTimeout(() => {
				previewUrl = '';
			}, 2000);

			onMapUploaded?.();
		} catch (error) {
			toast.error('Upload failed', {
				description: error instanceof Error ? error.message : 'An unknown error occurred'
			});
			previewUrl = '';
		} finally {
			uploading = false;
		}
	}

	async function deleteExistingMap() {
		try {
			const url = `/api/campaigns/${campaignSlug}/map/upload${mapType === 'player' ? '?mapType=player' : ''}`;
			const response = await fetch(url, {
				method: 'DELETE'
			});

			if (response.ok) {
				showUploadInterface = true;
				const mapLabel = label || (mapType === 'player' ? 'Player map' : 'Map');
				toast.success('Map deleted', {
					description: `${mapLabel} deleted successfully`
				});

				onDeleted?.(); // Notify parent of deletion
				onMapUploaded?.(); // Refresh parent
			} else {
				throw new Error('Failed to delete map');
			}
		} catch (error) {
			toast.error('Delete failed', {
				description: error instanceof Error ? error.message : 'Failed to delete map'
			});
		}
	}

	function openDeleteConfirmDialog() {
		confirmDeleteDialogOpen = true;
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

	onMount(() => {
		showUploadInterface = !mapExists;
	});
</script>

<div class="space-y-4">
	<!-- Map Status -->
	{#if mapExists && !showUploadInterface}
		<div class="flex items-center justify-between rounded-lg">
			<div class="flex items-center gap-2">
				<div
					class="flex h-10 w-10 items-center justify-center {mapType === 'dm'
						? 'bg-green-100'
						: 'bg-orange-100'} rounded-full"
				>
					<Image class="h-5 w-5 {mapType === 'dm' ? 'text-green-600' : 'text-orange-600'}" />
				</div>
				<div>
					<p class="font-medium">{label || 'Map Uploaded'}</p>
				</div>
			</div>
			<div class="flex gap-2">
				<Button variant="outline" size="sm" onclick={() => (showUploadInterface = true)}>
					Replace
				</Button>
				<Button variant="outline" size="sm" onclick={openDeleteConfirmDialog}>
					<Trash2 class="h-4 w-4" />
				</Button>
			</div>
		</div>
	{/if}

	<!-- Upload Interface -->
	{#if showUploadInterface || !mapExists}
		<div>
			<div>
				{#if mapExists}
					<div class="mb-4 flex items-center justify-between">
						<h4 class="font-medium">{label ? `Replace ${label}` : 'Replace Map'}</h4>
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
							<LoaderCircle class="mx-auto mb-3 h-8 w-8 animate-spin text-primary" />
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
							<Upload class="mx-auto h-12 w-12 text-muted-foreground" />
							<div>
								<p class="mb-2 font-medium">
									{label ? `Drop ${label} here` : 'Drop your D&D map here'}
								</p>
								<p class="mb-4 text-sm text-muted-foreground">or click to browse files</p>
								<Button onclick={() => fileInput.click()}>
									<Upload class="mr-2 h-4 w-4" />
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

<!-- Confirm Delete Dialog -->
<ConfirmDialog
	bind:open={confirmDeleteDialogOpen}
	title="Delete Map"
	description={`Are you sure you want to delete the current ${label || (mapType === 'player' ? 'player map' : 'map')}? This cannot be undone.`}
	actions={[
		{
			label: 'Cancel',
			variant: 'outline',
			action: () => {}
		},
		{
			label: 'Delete',
			variant: 'destructive',
			action: deleteExistingMap
		}
	]}
/>
