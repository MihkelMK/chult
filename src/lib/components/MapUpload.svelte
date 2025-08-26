<script lang="ts">
	import MapImage from './MapImage.svelte';

	interface Props {
		hasMapImage?: boolean;
		campaignSlug: string;
		onMapUploaded?: () => void;
	}

	let { hasMapImage, campaignSlug, onMapUploaded }: Props = $props();

	// Upload state
	let fileInput: HTMLInputElement;
	let dragActive = $state(false);
	let uploading = $state(false);
	let uploadError = $state('');
	let uploadSuccess = $state('');
	let previewUrl = $state('');
	let showUploadInterface = $state(!hasMapImage);
	let mapExists = $state(hasMapImage || false);

	// Map viewing state
	let showMapViewer = $state(false);
	let currentView = $state<'overview' | 'detail' | 'hexgrid'>('overview');

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

		if (file.size > 100 * 1024 * 1024) {
			uploadError = 'File size must be less than 100MB';
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
			showMapViewer = true;

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
				showMapViewer = false;
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

<div class="space-y-6">
	<!-- Header -->
	<div class="flex justify-between items-start">
		<div>
			<h2 class="text-xl font-semibold text-gray-900">Campaign Map</h2>
			<p class="mt-1 text-sm text-gray-600">
				{mapExists
					? 'Manage your campaign map and reveal tiles to players'
					: 'Upload a map to get started'}
			</p>
		</div>

		{#if mapExists}
			<div class="flex space-x-3">
				<button
					onclick={() => (showUploadInterface = !showUploadInterface)}
					class="py-2 px-4 text-sm font-medium text-gray-700 bg-gray-100 rounded-md transition-colors hover:bg-gray-200"
				>
					{showUploadInterface ? 'Cancel' : 'Replace Map'}
				</button>

				<button
					onclick={() => (showMapViewer = !showMapViewer)}
					class="py-2 px-4 text-sm font-medium text-white bg-blue-600 rounded-md transition-colors hover:bg-blue-700"
				>
					{showMapViewer ? 'Hide Map' : 'View Map'}
				</button>

				<button
					onclick={deleteExistingMap}
					class="py-2 px-4 text-sm font-medium text-white bg-red-600 rounded-md transition-colors hover:bg-red-700"
				>
					Delete
				</button>
			</div>
		{/if}
	</div>

	<!-- Status Messages -->
	{#if uploadError}
		<div class="p-4 text-red-700 bg-red-50 rounded-lg border border-red-200">
			<div class="flex">
				<svg
					class="mt-0.5 mr-2 w-5 h-5 text-red-400"
					fill="none"
					stroke="currentColor"
					viewBox="0 0 24 24"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
					/>
				</svg>
				<span>{uploadError}</span>
			</div>
		</div>
	{/if}

	{#if uploadSuccess}
		<div class="p-4 text-green-700 bg-green-50 rounded-lg border border-green-200">
			<div class="flex">
				<svg
					class="mt-0.5 mr-2 w-5 h-5 text-green-400"
					fill="none"
					stroke="currentColor"
					viewBox="0 0 24 24"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
					/>
				</svg>
				<div>
					<p class="font-medium">Success!</p>
					<p class="mt-1 text-sm">{uploadSuccess}</p>
				</div>
			</div>
		</div>
	{/if}

	<!-- Upload Interface -->
	{#if showUploadInterface}
		<div class="bg-white rounded-lg border border-gray-300">
			<div class="p-6">
				<h3 class="mb-4 text-lg font-medium text-gray-900">
					{mapExists ? 'Replace Map' : 'Upload Map'}
				</h3>

				<!-- Upload Area -->
				<!-- svelte-ignore a11y_no_static_element_interactions -->
				<div
					class="rounded-lg border-2 border-dashed p-8 text-center transition-colors {dragActive
						? 'border-blue-400 bg-blue-50'
						: 'border-gray-300 hover:border-gray-400'}"
					ondrop={handleDrop}
					ondragover={handleDragOver}
					ondragleave={handleDragLeave}
				>
					{#if uploading}
						<div class="py-8">
							<svg
								class="mx-auto mb-4 w-8 h-8 text-blue-600 animate-spin"
								fill="none"
								viewBox="0 0 24 24"
							>
								<circle
									class="opacity-25"
									cx="12"
									cy="12"
									r="10"
									stroke="currentColor"
									stroke-width="4"
								></circle>
								<path
									class="opacity-75"
									fill="currentColor"
									d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
								></path>
							</svg>
							<p class="text-sm text-gray-600">Processing map...</p>
							<p class="mt-1 text-xs text-gray-500">Large maps may take a moment to optimize</p>
						</div>
					{:else if previewUrl}
						<div class="space-y-4">
							<img
								src={previewUrl}
								alt="Map preview"
								class="mx-auto max-h-48 rounded-lg shadow-md"
							/>
							<p class="text-sm font-medium text-green-600">Upload in progress...</p>
						</div>
					{:else}
						<div class="space-y-6">
							<svg
								class="mx-auto w-16 h-16 text-gray-400"
								stroke="currentColor"
								fill="none"
								viewBox="0 0 48 48"
							>
								<path
									d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
									stroke-width="2"
									stroke-linecap="round"
									stroke-linejoin="round"
								/>
							</svg>

							<div>
								<p class="mb-2 text-xl text-gray-600">Drop your D&D map here</p>
								<p class="mb-6 text-sm text-gray-500">or click to browse files</p>
								<button
									onclick={() => fileInput.click()}
									class="py-3 px-6 font-medium text-white bg-blue-600 rounded-lg transition-colors hover:bg-blue-700"
								>
									Choose Map File
								</button>
							</div>

							<div class="space-y-1 text-xs text-gray-500">
								<p>• JPEG, PNG, or WebP formats</p>
								<p>• Maximum 100MB file size</p>
								<p>• High resolution images welcome (will be optimized automatically)</p>
								<p>• Square or landscape orientation works best</p>
							</div>
						</div>
					{/if}
				</div>
			</div>
		</div>
	{/if}

	<!-- Map Viewer -->
	{#if showMapViewer && mapExists}
		<div class="bg-white rounded-lg border border-gray-300">
			<div class="p-6">
				<div class="flex justify-between items-center mb-4">
					<h3 class="text-lg font-medium text-gray-900">Map Preview</h3>

					<!-- View controls -->
					<div class="flex space-x-2">
						<button
							onclick={() => (currentView = 'overview')}
							class="rounded-md px-3 py-1 text-sm transition-colors {currentView === 'overview'
								? 'bg-blue-600 text-white'
								: 'bg-gray-100 text-gray-700 hover:bg-gray-200'}"
						>
							Overview
						</button>
						<button
							onclick={() => (currentView = 'detail')}
							class="rounded-md px-3 py-1 text-sm transition-colors {currentView === 'detail'
								? 'bg-blue-600 text-white'
								: 'bg-gray-100 text-gray-700 hover:bg-gray-200'}"
						>
							Detail
						</button>
						<button
							onclick={() => (currentView = 'hexgrid')}
							class="rounded-md px-3 py-1 text-sm transition-colors {currentView === 'hexgrid'
								? 'bg-blue-600 text-white'
								: 'bg-gray-100 text-gray-700 hover:bg-gray-200'}"
						>
							Hex Grid
						</button>
					</div>
				</div>

				<!-- Progressive map display -->
				<div class="relative">
					<MapImage
						{campaignSlug}
						class="object-contain w-full max-h-96"
						onLoad={() => {
							// Map loaded successfully
						}}
						onError={() => {
							uploadError = 'Failed to load map preview';
						}}
					/>

					<!-- Overlay info -->
					<div
						class="absolute bottom-4 left-4 py-2 px-3 text-sm text-white bg-black bg-opacity-60 rounded-lg"
					>
						<p>{currentView} view • Optimized by imgproxy</p>
						<p class="text-xs opacity-90">Click quality buttons to upgrade resolution</p>
					</div>
				</div>

				<div class="flex justify-between items-center mt-4 text-sm text-gray-600">
					<!-- <div class="flex items-center space-x-4"> -->
					<!-- 	<span>Revealed: {data.revealedTiles.length} tiles</span> -->
					<!-- 	<span>POIs: {data.pointsOfInterest.length}</span> -->
					<!-- </div> -->

					<a
						href="/dm/{campaignSlug}/map/interactive"
						class="py-2 px-4 text-sm font-medium text-white bg-green-600 rounded-md transition-colors hover:bg-green-700"
					>
						Open Interactive Map →
					</a>
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
