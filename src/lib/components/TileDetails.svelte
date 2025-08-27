<script lang="ts">
	import type { TileCoords, MapMarkerResponse } from '$lib/types';
	import { getCampaignState } from '$lib/contexts/campaignContext';
	import type { DMCampaignState } from '$lib/stores/dmCampaignState.svelte';
	import type { PlayerCampaignState } from '$lib/stores/playerCampaignState.svelte';

	interface Props {
		selectedTile: TileCoords;
		role: 'dm' | 'player';
		onClose: () => void;
	}

	let { selectedTile, role, onClose }: Props = $props();

	const campaignState = getCampaignState();
	const { campaign: campaignData, makeApiRequest } = campaignState;

	let markers = $derived(
		campaignData.mapMarkers.filter(
			(m) => m.x === selectedTile.x && m.y === selectedTile.y
		) as MapMarkerResponse[]
	);
	let pois = $derived(markers.filter((m) => m.type === 'poi'));
	let notes = $derived(markers.filter((m) => m.type === 'note'));
	let isRevealed = $derived(
		campaignData.revealedTiles.some((t) => t.x === selectedTile.x && t.y === selectedTile.y)
	);

	// Marker Management
	let showAddForm = $state(false);
	let editingMarker = $state<MapMarkerResponse | null>(null);
	let newMarker = $state({
		type: 'poi' as 'poi' | 'note',
		title: '',
		content: '',
		visibleToPlayers: true
	});

	// State
	let submitting = $state(false);
	let deleting = $state(false);
	let error = $state('');
	let success = $state('');

	function openAddForm(type: 'poi' | 'note') {
		newMarker = { type, title: '', content: '', visibleToPlayers: true };
		editingMarker = null;
		showAddForm = true;
	}

	function openEditForm(marker: MapMarkerResponse) {
		editingMarker = { ...marker };
		showAddForm = false;
	}

	async function submitMarker() {
		const isEditing = editingMarker !== null;
		const markerToSubmit = isEditing ? editingMarker : newMarker;

		if (!markerToSubmit) return;

		if (markerToSubmit.type === 'poi' && !markerToSubmit.title?.trim()) return;
		if (markerToSubmit.type === 'note' && !markerToSubmit.content?.trim()) return;

		submitting = true;
		error = '';

		const markerData = {
			x: selectedTile.x,
			y: selectedTile.y,
			type: markerToSubmit.type,
			title: markerToSubmit.title?.trim() || null,
			content: markerToSubmit.content?.trim() || null,
			visibleToPlayers: markerToSubmit.visibleToPlayers
		};

		try {
			if (isEditing && editingMarker) {
				await makeApiRequest(`map-markers/${editingMarker.id}`, 'PUT', markerData);
				success = 'Marker updated successfully';
			} else {
				if (role === 'dm') {
					await (campaignState as DMCampaignState).createMarker({
						...markerData,
						authorRole: 'dm',
						imagePath: null
					});
				} else {
					await (campaignState as PlayerCampaignState).createNote({
						...markerData,
						authorRole: 'player',
						imagePath: null
					});
				}
				success = 'Marker added successfully';
			}

			showAddForm = false;
			editingMarker = null;
		} catch (err) {
			error = err instanceof Error ? err.message : 'An unknown error occurred.';
		} finally {
			submitting = false;
		}
	}

	async function deleteMarker(markerId: number) {
		if (!confirm('Are you sure you want to delete this item?')) return;
		deleting = markerId;
		error = '';
		try {
			await makeApiRequest(`map-markers/${markerId}`, 'DELETE');
			success = 'Item deleted successfully';
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to delete item.';
		} finally {
			deleting = null;
		}
	}

	async function toggleTileVisibility() {
		if (role !== 'dm') return;
		if (isRevealed) {
			// Future implementation for hiding tiles
		} else {
			(campaignState as DMCampaignState).revealTiles([selectedTile]);
		}
	}

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
			if (editingMarker) editingMarker = null;
			else if (showAddForm) showAddForm = false;
			else onClose();
		}
	}
</script>

<div
	role="dialog"
	aria-modal="true"
	tabindex="-1"
	class="bg-opacity-50 fixed inset-0 z-50 flex items-center justify-center bg-black p-4"
	onclick={(e) => {
		if (e.target === e.currentTarget) onClose();
	}}
	onkeydown={handleKeydown}
>
	<div class="max-h-[90vh] w-full max-w-4xl overflow-hidden rounded-xl bg-white shadow-xl">
		<!-- Header -->
		<div class="flex items-center justify-between border-b border-gray-200 bg-gray-50 p-6">
			<div>
				<h3 class="flex items-center text-xl font-semibold text-gray-900">
					{#if role === 'dm'}
						<span
							class="mr-3 inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800"
						>
							DM
						</span>
					{/if}
					Tile {selectedTile.x + 1},{selectedTile.y + 1}
				</h3>
				{#if role === 'dm'}
					<p class="text-sm text-gray-600">
						{isRevealed ? 'Visible to players' : 'Hidden from players'}
					</p>
				{/if}
			</div>
			<div class="flex items-center space-x-3">
				{#if role === 'dm'}
					<button
						onclick={toggleTileVisibility}
						class="rounded-md px-3 py-1 text-sm font-medium transition-colors {isRevealed
							? 'bg-orange-100 text-orange-800 hover:bg-orange-200'
							: 'bg-green-100 text-green-800 hover:bg-green-200'}"
					>
						{isRevealed ? 'Hide' : 'Reveal'}
					</button>
				{/if}
				<button
					onclick={onClose}
					class="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
					aria-label="Close"
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

		<!-- Content -->
		<div class="max-h-[calc(90vh-150px)] overflow-y-auto p-6">
			<!-- Points of Interest -->
			<div class="mb-8">
				<div class="mb-4 flex items-center justify-between">
					<h4 class="text-lg font-medium text-gray-900">Points of Interest ({pois.length})</h4>
					{#if role === 'dm'}
						<button
							onclick={() => openAddForm('poi')}
							class="rounded-md border border-blue-300 px-3 py-1 text-sm font-medium text-blue-600 hover:bg-blue-50"
						>
							Add POI
						</button>
					{/if}
				</div>
				{#if pois.length > 0}
					<div class="space-y-4">
						{#each pois as poi (poi.id)}
							<div class="rounded-lg border p-4">
								<div class="flex items-start justify-between">
									<div class="flex-1">
										<h5 class="font-medium text-gray-900">{poi.title}</h5>
										{#if poi.content}
											<p class="mb-2 text-sm text-gray-700">{poi.content}</p>
										{/if}
									</div>
									{#if role === 'dm'}
										<div class="ml-4 flex items-center space-x-2">
											<button onclick={() => openEditForm(poi)} title="Edit">Edit</button>
											<button onclick={() => deleteMarker(poi.id)} title="Delete">Delete</button>
										</div>
									{/if}
								</div>
							</div>
						{/each}
					</div>
				{:else}
					<p class="py-6 text-center text-gray-500">No points of interest on this tile.</p>
				{/if}
			</div>

			<!-- Player Notes -->
			<div>
				<div class="mb-4 flex items-center justify-between">
					<h4 class="text-lg font-medium text-gray-900">Notes ({notes.length})</h4>
					<button
						onclick={() => openAddForm('note')}
						class="rounded-md border border-purple-300 px-3 py-1 text-sm font-medium text-purple-600 hover:bg-purple-50"
					>
						Add Note
					</button>
				</div>
				{#if notes.length > 0}
					<div class="space-y-3">
						{#each notes as note (note.id)}
							<div class="rounded-lg border p-4">
								<p class="text-gray-900">{note.content}</p>
								{#if role === 'dm'}
									<div class="mt-2 flex items-center justify-end space-x-2">
										<button onclick={() => openEditForm(note)} title="Edit">Edit</button>
										<button onclick={() => deleteMarker(note.id)} title="Delete">Delete</button>
									</div>
								{/if}
							</div>
						{/each}
					</div>
				{:else}
					<p class="py-6 text-center text-gray-500">No notes on this tile.</p>
				{/if}
			</div>
		</div>
	</div>
</div>

<!-- Add/Edit Marker Modal -->
{#if showAddForm || editingMarker}
	{@const isEditing = editingMarker !== null}
	{@const marker = isEditing ? editingMarker : newMarker}
	{#if marker}
		<div
			role="dialog"
			aria-modal="true"
			tabindex="-1"
			class="bg-opacity-75 fixed inset-0 z-60 flex items-center justify-center bg-black p-4"
			onclick={(e) => {
				if (e.target === e.currentTarget) {
					showAddForm = false;
					editingMarker = null;
				}
			}}
			onkeydown={(e) => {
				if (e.key === 'Escape') {
					showAddForm = false;
					editingMarker = null;
				}
			}}
		>
			<div class="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
				<h3 class="mb-4 text-lg font-semibold text-gray-900">
					{isEditing ? 'Edit' : 'Add'}
					{marker.type === 'poi' ? 'Point of Interest' : 'Note'}
				</h3>
				<div class="space-y-4">
					{#if marker.type === 'poi'}
						<div>
							<label for="marker-title" class="mb-2 block text-sm font-medium text-gray-700"
								>Title *</label
							>
							<input
								type="text"
								id="marker-title"
								bind:value={marker.title}
								class="w-full rounded-md border-gray-300"
								disabled={submitting}
							/>
						</div>
					{/if}
					<div>
						<label for="marker-content" class="mb-2 block text-sm font-medium text-gray-700">
							{marker.type === 'poi' ? 'Description' : 'Content *'}
						</label>
						<textarea
							id="marker-content"
							bind:value={marker.content}
							rows="4"
							class="w-full resize-none rounded-md border-gray-300"
							disabled={submitting}
						></textarea>
					</div>
					{#if role === 'dm' && marker.type === 'poi'}
						<label class="flex items-center">
							<input
								type="checkbox"
								bind:checked={marker.visibleToPlayers}
								class="rounded border-gray-300"
								disabled={submitting}
							/>
							<span class="ml-2 text-sm text-gray-700">Visible to players</span>
						</label>
					{/if}
				</div>
				<div class="mt-6 flex justify-end space-x-3">
					<button
						onclick={() => {
							showAddForm = false;
							editingMarker = null;
						}}
						class="rounded-md bg-gray-100 px-4 py-2"
						disabled={submitting}
					>
						Cancel
					</button>
					<button
						onclick={submitMarker}
						class="rounded-md bg-blue-600 px-4 py-2 text-white"
						disabled={submitting}
					>
						{submitting ? 'Saving...' : 'Save'}
					</button>
				</div>
			</div>
		</div>
	{/if}
{/if}
