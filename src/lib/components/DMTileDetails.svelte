<script lang="ts">
	import type { TileCoords, PointOfInterestResponse, TileNoteResponse } from '$lib/types';

	interface Props {
		selectedTile: TileCoords;
		tileData: {
			pois: PointOfInterestResponse[];
			notes: TileNoteResponse[];
		};
		campaignSlug: string;
		onClose: () => void;
		onTileUpdated: () => void;
		onTileRevealed?: (coords: TileCoords) => void;
		onTileHidden?: (coords: TileCoords) => void;
		isRevealed?: boolean;
	}

	let {
		selectedTile,
		tileData,
		campaignSlug,
		onClose,
		onTileUpdated,
		onTileRevealed,
		onTileHidden,
		isRevealed = false
	}: Props = $props();

	// POI Management
	let showAddPOI = $state(false);
	let editingPOI = $state<PointOfInterestResponse | null>(null);
	let newPOI = $state({
		title: '',
		description: '',
		visibleToPlayers: true
	});

	// State
	let addingPOI = $state(false);
	let updatingPOI = $state(false);
	let deletingPOI = $state<number | null>(null);
	let error = $state('');
	let success = $state('');

	async function addPOI() {
		if (!newPOI.title.trim()) return;

		addingPOI = true;
		error = '';

		try {
			const response = await fetch(`/api/campaigns/${campaignSlug}/pois`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					x: selectedTile.x,
					y: selectedTile.y,
					title: newPOI.title.trim(),
					description: newPOI.description.trim() || null,
					visibleToPlayers: newPOI.visibleToPlayers
				})
			});

			if (!response.ok) {
				const errorData = await response.json();
				error = errorData.message || 'Failed to add POI';
				return;
			}

			// Success
			newPOI = { title: '', description: '', visibleToPlayers: true };
			showAddPOI = false;
			success = 'Point of interest added successfully';
			onTileUpdated();
		} catch {
			error = 'Failed to add POI. Please try again.';
		} finally {
			addingPOI = false;
		}
	}

	async function updatePOI() {
		if (!editingPOI) return;

		updatingPOI = true;
		error = '';

		try {
			const response = await fetch(`/api/campaigns/${campaignSlug}/pois/${editingPOI.id}`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					title: editingPOI.title.trim(),
					description: editingPOI.description?.trim() || null,
					visibleToPlayers: editingPOI.visibleToPlayers
				})
			});

			if (!response.ok) {
				const errorData = await response.json();
				error = errorData.message || 'Failed to update POI';
				return;
			}

			// Success
			editingPOI = null;
			success = 'Point of interest updated successfully';
			onTileUpdated();
		} catch {
			error = 'Failed to update POI. Please try again.';
		} finally {
			updatingPOI = false;
		}
	}

	async function deletePOI(poiId: number) {
		if (!confirm('Are you sure you want to delete this point of interest?')) {
			return;
		}

		deletingPOI = poiId;
		error = '';

		try {
			const response = await fetch(`/api/campaigns/${campaignSlug}/pois/${poiId}`, {
				method: 'DELETE'
			});

			if (!response.ok) {
				const errorData = await response.json();
				error = errorData.message || 'Failed to delete POI';
				return;
			}

			success = 'Point of interest deleted successfully';
			onTileUpdated();
		} catch {
			error = 'Failed to delete POI. Please try again.';
		} finally {
			deletingPOI = null;
		}
	}

	async function toggleTileVisibility() {
		if (isRevealed) {
			onTileHidden?.(selectedTile);
		} else {
			onTileRevealed?.(selectedTile);
		}
	}

	// Clear messages after delay
	$effect(() => {
		if (success) {
			const timer = setTimeout(() => (success = ''), 3000);
			return () => clearTimeout(timer);
		}
	});

	$effect(() => {
		if (error) {
			const timer = setTimeout(() => (error = ''), 5000);
			return () => clearTimeout(timer);
		}
	});

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			if (editingPOI) {
				editingPOI = null;
			} else if (showAddPOI) {
				showAddPOI = false;
			} else {
				onClose();
			}
		}
	}
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	class="bg-opacity-50 fixed inset-0 z-50 flex items-center justify-center bg-black p-4"
	onclick={(e) => {
		if (e.target === e.currentTarget) onClose();
	}}
>
	<div
		class="max-h-[90vh] w-full max-w-4xl overflow-hidden rounded-xl bg-white shadow-xl"
		onkeydown={handleKeydown}
		tabindex="-1"
	>
		<!-- Header -->
		<div class="flex items-center justify-between border-b border-gray-200 bg-gray-50 p-6">
			<div>
				<h3 class="flex items-center text-xl font-semibold text-gray-900">
					<span
						class="mr-3 inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800"
					>
						DM
					</span>
					Tile {selectedTile.x + 1},{selectedTile.y + 1}
				</h3>
				<p class="text-sm text-gray-600">
					{isRevealed ? 'Visible to players' : 'Hidden from players'}
				</p>
			</div>
			<div class="flex items-center space-x-3">
				<button
					onclick={toggleTileVisibility}
					class="rounded-md px-3 py-1 text-sm font-medium transition-colors {isRevealed
						? 'bg-orange-100 text-orange-800 hover:bg-orange-200'
						: 'bg-green-100 text-green-800 hover:bg-green-200'}"
				>
					{isRevealed ? 'Hide from Players' : 'Reveal to Players'}
				</button>

				<!-- svelte-ignore a11y_consider_explicit_label -->
				<button
					onclick={onClose}
					class="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
				>
					<svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M6 18L18 6M6 6l12 12"
						/>
					</svg>
				</button>
			</div>
		</div>

		<!-- Status Messages -->
		{#if error}
			<div class="mx-6 mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-red-700">
				<div class="flex">
					<svg
						class="mr-2 h-5 w-5 text-red-400"
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
					<span>{error}</span>
				</div>
			</div>
		{/if}

		{#if success}
			<div class="mx-6 mt-4 rounded-lg border border-green-200 bg-green-50 p-3 text-green-700">
				<div class="flex">
					<svg
						class="mr-2 h-5 w-5 text-green-400"
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
					<span>{success}</span>
				</div>
			</div>
		{/if}

		<!-- Content -->
		<div class="max-h-96 overflow-y-auto p-6">
			<!-- Points of Interest -->
			<div class="mb-8">
				<div class="mb-4 flex items-center justify-between">
					<h4 class="flex items-center text-lg font-medium text-gray-900">
						<svg
							class="mr-2 h-5 w-5 text-blue-500"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
							/>
						</svg>
						Points of Interest ({tileData.pois.length})
					</h4>
					<button
						onclick={() => (showAddPOI = true)}
						class="rounded-md border border-blue-300 px-3 py-1 text-sm font-medium text-blue-600 transition-colors hover:bg-blue-50"
					>
						Add POI
					</button>
				</div>

				{#if tileData.pois.length > 0}
					<div class="space-y-4">
						{#each tileData.pois as poi (poi.id)}
							<div
								class="rounded-lg border border-gray-200 p-4 {poi.visibleToPlayers
									? 'border-blue-200 bg-blue-50'
									: 'bg-gray-50'}"
							>
								<div class="flex items-start justify-between">
									<div class="flex-1">
										<div class="mb-2 flex items-center space-x-2">
											<h5 class="font-medium text-gray-900">{poi.title}</h5>
											<span
												class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium {poi.visibleToPlayers
													? 'bg-green-100 text-green-800'
													: 'bg-red-100 text-red-800'}"
											>
												{poi.visibleToPlayers ? 'Visible' : 'Hidden'}
											</span>
										</div>
										{#if poi.description}
											<p class="mb-2 text-sm text-gray-700">{poi.description}</p>
										{/if}
										<p class="text-xs text-gray-500">
											Created: {new Date(poi.createdAt).toLocaleString()}
										</p>
									</div>
									<div class="ml-4 flex items-center space-x-2">
										<!-- svelte-ignore a11y_consider_explicit_label -->
										<button
											onclick={() => (editingPOI = { ...poi })}
											class="rounded p-1 text-gray-400 hover:text-blue-600"
											title="Edit POI"
										>
											<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
												<path
													stroke-linecap="round"
													stroke-linejoin="round"
													stroke-width="2"
													d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
												/>
											</svg>
										</button>
										<!-- svelte-ignore a11y_consider_explicit_label -->
										<button
											onclick={() => deletePOI(poi.id)}
											disabled={deletingPOI === poi.id}
											class="rounded p-1 text-gray-400 hover:text-red-600 disabled:opacity-50"
											title="Delete POI"
										>
											<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
												<path
													stroke-linecap="round"
													stroke-linejoin="round"
													stroke-width="2"
													d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
												/>
											</svg>
										</button>
									</div>
								</div>
							</div>
						{/each}
					</div>
				{:else}
					<div class="py-6 text-center text-gray-500">
						<svg
							class="mx-auto mb-3 h-12 w-12 text-gray-300"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
							/>
						</svg>
						<p>No points of interest on this tile</p>
					</div>
				{/if}
			</div>

			<!-- Player Notes -->
			<div>
				<h4 class="mb-4 flex items-center text-lg font-medium text-gray-900">
					<svg
						class="mr-2 h-5 w-5 text-purple-500"
						fill="none"
						stroke="currentColor"
						viewBox="0 0 24 24"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5"
						/>
					</svg>
					Player Notes ({tileData.notes.length})
				</h4>

				{#if tileData.notes.length > 0}
					<div class="space-y-3">
						{#each tileData.notes as note (note.id)}
							<div class="rounded-lg border border-purple-200 bg-purple-50 p-4">
								<p class="mb-2 text-gray-900">{note.content}</p>
								<p class="text-xs text-purple-600">
									{new Date(note.createdAt).toLocaleString()}
								</p>
							</div>
						{/each}
					</div>
				{:else}
					<div class="py-6 text-center text-gray-500">
						<svg
							class="mx-auto mb-3 h-12 w-12 text-gray-300"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5"
							/>
						</svg>
						<p>No player notes on this tile</p>
					</div>
				{/if}
			</div>
		</div>
	</div>
</div>

<!-- Add POI Modal -->
{#if showAddPOI}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="bg-opacity-75 fixed inset-0 z-60 flex items-center justify-center bg-black p-4"
		onclick={(e) => {
			if (e.target === e.currentTarget) showAddPOI = false;
		}}
	>
		<div class="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
			<h3 class="mb-4 text-lg font-semibold text-gray-900">Add Point of Interest</h3>

			<div class="space-y-4">
				<div>
					<!-- svelte-ignore a11y_label_has_associated_control -->
					<label class="mb-2 block text-sm font-medium text-gray-700">Title *</label>
					<input
						type="text"
						bind:value={newPOI.title}
						placeholder="Ancient Ruins, Hidden Cave, etc."
						class="w-full rounded-md border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
						disabled={addingPOI}
					/>
				</div>

				<div>
					<!-- svelte-ignore a11y_label_has_associated_control -->
					<label class="mb-2 block text-sm font-medium text-gray-700">Description</label>
					<textarea
						bind:value={newPOI.description}
						placeholder="Describe what players find here..."
						rows="3"
						class="w-full resize-none rounded-md border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
						disabled={addingPOI}
					></textarea>
				</div>

				<div>
					<label class="flex items-center">
						<input
							type="checkbox"
							bind:checked={newPOI.visibleToPlayers}
							class="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
							disabled={addingPOI}
						/>
						<span class="ml-2 text-sm text-gray-700">Visible to players</span>
					</label>
				</div>
			</div>

			<div class="mt-6 flex justify-end space-x-3">
				<button
					onclick={() => (showAddPOI = false)}
					class="rounded-md bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-200"
					disabled={addingPOI}
				>
					Cancel
				</button>
				<button
					onclick={addPOI}
					disabled={addingPOI || !newPOI.title.trim()}
					class="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
				>
					{addingPOI ? 'Adding...' : 'Add POI'}
				</button>
			</div>
		</div>
	</div>
{/if}

<!-- Edit POI Modal -->
{#if editingPOI}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="bg-opacity-75 fixed inset-0 z-60 flex items-center justify-center bg-black p-4"
		onclick={(e) => {
			if (e.target === e.currentTarget) editingPOI = null;
		}}
	>
		<div class="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
			<h3 class="mb-4 text-lg font-semibold text-gray-900">Edit Point of Interest</h3>

			<div class="space-y-4">
				<div>
					<!-- svelte-ignore a11y_label_has_associated_control -->
					<label class="mb-2 block text-sm font-medium text-gray-700">Title *</label>
					<input
						type="text"
						bind:value={editingPOI.title}
						class="w-full rounded-md border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
						disabled={updatingPOI}
					/>
				</div>

				<div>
					<!-- svelte-ignore a11y_label_has_associated_control -->
					<label class="mb-2 block text-sm font-medium text-gray-700">Description</label>
					<textarea
						bind:value={editingPOI.description}
						rows="3"
						class="w-full resize-none rounded-md border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
						disabled={updatingPOI}
					></textarea>
				</div>

				<div>
					<label class="flex items-center">
						<input
							type="checkbox"
							bind:checked={editingPOI.visibleToPlayers}
							class="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
							disabled={updatingPOI}
						/>
						<span class="ml-2 text-sm text-gray-700">Visible to players</span>
					</label>
				</div>
			</div>

			<div class="mt-6 flex justify-end space-x-3">
				<button
					onclick={() => (editingPOI = null)}
					class="rounded-md bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-200"
					disabled={updatingPOI}
				>
					Cancel
				</button>
				<button
					onclick={updatePOI}
					disabled={updatingPOI || !editingPOI.title.trim()}
					class="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
				>
					{updatingPOI ? 'Updating...' : 'Update POI'}
				</button>
			</div>
		</div>
	</div>
{/if}
