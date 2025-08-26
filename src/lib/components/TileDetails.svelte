<script lang="ts">
	import type {
		TileCoords,
		PointOfInterestResponse,
		TileNoteResponse,
		PlayerPointOfInterest
	} from '$lib/types';

	interface Props {
		selectedTile: TileCoords;
		tileData: {
			pois: PointOfInterestResponse[] | PlayerPointOfInterest[];
			notes: TileNoteResponse[];
		};
		campaignSlug: string;
		onClose: () => void;
		onNoteAdded: () => void;
	}

	let { selectedTile, tileData, campaignSlug, onClose, onNoteAdded }: Props = $props();

	let newNote = $state('');
	let addingNote = $state(false);
	let addNoteError = $state('');

	async function addNote() {
		if (!newNote.trim()) return;

		addingNote = true;
		addNoteError = '';

		try {
			const response = await fetch(`/api/campaigns/${campaignSlug}/player/notes`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					x: selectedTile.x,
					y: selectedTile.y,
					content: newNote.trim()
				})
			});

			if (!response.ok) {
				const error = await response.json();
				addNoteError = error.message || 'Failed to add note';
				return;
			}

			// Success
			newNote = '';
			onNoteAdded();
		} catch {
			addNoteError = 'Failed to add note. Please try again.';
		} finally {
			addingNote = false;
		}
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			onClose();
		} else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
			addNote();
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
		class="max-h-[90vh] w-full max-w-2xl overflow-hidden rounded-xl bg-white shadow-xl"
		onkeydown={handleKeydown}
		tabindex="-1"
	>
		<!-- Header -->
		<div class="flex items-center justify-between border-b border-gray-200 p-6">
			<div>
				<h3 class="text-xl font-semibold text-gray-900">
					Tile {selectedTile.x + 1},{selectedTile.y + 1}
				</h3>
				<p class="text-sm text-gray-600">Explore this location</p>
			</div>
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

		<!-- Content -->
		<div class="max-h-96 overflow-y-auto p-6">
			<!-- Points of Interest -->
			{#if tileData.pois.length > 0}
				<div class="mb-6">
					<h4 class="mb-4 flex items-center text-lg font-medium text-gray-900">
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
						Points of Interest
					</h4>
					<div class="space-y-4">
						{#each tileData.pois as poi (poi.id)}
							<div class="rounded-lg border border-blue-200 bg-blue-50 p-4">
								<h5 class="mb-2 font-medium text-blue-900">{poi.title}</h5>
								{#if poi.description}
									<p class="text-sm text-blue-700">{poi.description}</p>
								{/if}
								{#if poi.imagePath}
									<div class="mt-3">
										<img
											src="/api/images/{campaignSlug}/{poi.imagePath}"
											alt={poi.title}
											class="h-auto max-w-full rounded-lg"
										/>
									</div>
								{/if}
							</div>
						{/each}
					</div>
				</div>
			{/if}

			<!-- Existing Notes -->
			{#if tileData.notes.length > 0}
				<div class="mb-6">
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
						Your Notes
					</h4>
					<div class="space-y-3">
						{#each tileData.notes as note (note.id)}
							<div class="rounded-lg border border-purple-200 bg-purple-50 p-4">
								<p class="text-gray-900">{note.content}</p>
								<p class="mt-2 text-xs text-purple-600">
									{new Date(note.createdAt).toLocaleString()}
								</p>
							</div>
						{/each}
					</div>
				</div>
			{/if}

			<!-- Add New Note -->
			<div>
				<h4 class="mb-4 flex items-center text-lg font-medium text-gray-900">
					<svg
						class="mr-2 h-5 w-5 text-green-500"
						fill="none"
						stroke="currentColor"
						viewBox="0 0 24 24"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M12 6v6m0 0v6m0-6h6m-6 0H6"
						/>
					</svg>
					Add Note
				</h4>

				<div class="space-y-4">
					<textarea
						bind:value={newNote}
						placeholder="Document what you discovered here..."
						rows="4"
						class="w-full resize-none rounded-lg border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
						disabled={addingNote}
					></textarea>

					{#if addNoteError}
						<div class="text-sm text-red-600">{addNoteError}</div>
					{/if}

					<div class="flex items-center justify-between">
						<p class="text-xs text-gray-500">Press Cmd/Ctrl + Enter to save quickly</p>
						<div class="flex space-x-3">
							<button
								onclick={onClose}
								class="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-200"
							>
								Close
							</button>
							<button
								onclick={addNote}
								disabled={addingNote || !newNote.trim()}
								class="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
							>
								{addingNote ? 'Adding...' : 'Add Note'}
							</button>
						</div>
					</div>
				</div>
			</div>
		</div>
	</div>
</div>
