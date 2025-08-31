<script lang="ts">
	import type { TileCoords, MapMarkerResponse, PlayerMapMarkerResponse } from '$lib/types';
	import { getCampaignState } from '$lib/contexts/campaignContext';
	import { DMCampaignState } from '$lib/stores/dmCampaignState.svelte';
	import { PlayerCampaignState } from '$lib/stores/playerCampaignState.svelte';
	import MarkerImage from './MarkerImage.svelte';
	
	import { MapPin, StickyNote, Eye, User, Users, Plus, Edit, Trash2, X } from '@lucide/svelte';
	import * as Dialog from '$lib/components/ui/dialog';
	import * as Tabs from '$lib/components/ui/tabs';
	import { Button } from '$lib/components/ui/button';
	import { Badge } from '$lib/components/ui/badge';
	import { Separator } from '$lib/components/ui/separator';
	import { Card, CardContent } from '$lib/components/ui/card';

	interface Props {
		coords: TileCoords;
		role: 'dm' | 'player';
		open: boolean;
		onOpenChange: (open: boolean) => void;
	}

	let {
		coords,
		role,
		open = $bindable(),
		onOpenChange
	}: Props = $props();

	const campaignState = getCampaignState();
	const { campaign: campaignData } = campaignState;

	// Get markers for this tile
	let markers = $derived(
		campaignData.mapMarkers.filter(
			(m) => m.x === coords.x && m.y === coords.y
		)
	);

	// Separate POIs and notes with role-based filtering
	function hasVisibility(marker: MapMarkerResponse | PlayerMapMarkerResponse): marker is MapMarkerResponse {
		return 'visibleToPlayers' in marker;
	}

	function isVisibleToCurrentRole(marker: MapMarkerResponse | PlayerMapMarkerResponse): boolean {
		if (role === 'dm') return true; // DM sees everything
		if (!hasVisibility(marker)) return true; // Player markers are always visible to players
		return marker.visibleToPlayers;
	}

	let visiblePois = $derived(
		markers
			.filter((m) => m.type === 'poi')
			.filter(isVisibleToCurrentRole)
	);
	
	let visibleNotes = $derived(
		markers
			.filter((m) => m.type === 'note')
			.filter(isVisibleToCurrentRole)
	);

	// Check if tile is revealed
	let isRevealed = $derived(
		campaignData.revealedTiles.some((t: any) => t.x === coords.x && t.y === coords.y)
	);

	// State for creating/editing
	let editingMarker = $state<MapMarkerResponse | PlayerMapMarkerResponse | null>(null);
	let creatingType = $state<'poi' | 'note' | null>(null);
	let submitting = $state(false);
	let deleting = $state<number | null>(null);

	// Image upload state
	let fileInput = $state<HTMLInputElement>();
	let uploadingImage = $state(false);
	let uploadError = $state('');

	// Form state
	let formData = $state({
		type: 'poi' as 'poi' | 'note',
		title: '',
		content: '',
		visibleToPlayers: true,
		imagePath: null as string | null
	});

	function startCreate(type: 'poi' | 'note') {
		creatingType = type;
		editingMarker = null;
		formData = {
			type,
			title: '',
			content: '',
			visibleToPlayers: true,
			imagePath: null
		};
	}

	function startEdit(marker: MapMarkerResponse | PlayerMapMarkerResponse) {
		editingMarker = marker;
		creatingType = null;
		formData = {
			type: marker.type,
			title: marker.title || '',
			content: marker.content || '',
			visibleToPlayers: hasVisibility(marker) ? marker.visibleToPlayers : true,
			imagePath: marker.imagePath
		};
	}

	function cancelEdit() {
		editingMarker = null;
		creatingType = null;
	}

	async function saveMarker() {
		if (!formData.title?.trim() && formData.type === 'poi') return;
		if (!formData.content?.trim() && formData.type === 'note') return;

		submitting = true;

		try {
			if (editingMarker) {
				// Update existing marker
				const updateData = {
					title: formData.title?.trim() || null,
					content: formData.content?.trim() || null,
					visibleToPlayers: formData.visibleToPlayers
				};
				await campaignState.makeApiRequest(`map-markers/${editingMarker.id}`, 'PUT', updateData);
			} else {
				// Create new marker
				const markerData = {
					x: coords.x,
					y: coords.y,
					type: formData.type,
					title: formData.title?.trim() || null,
					content: formData.content?.trim() || null,
					visibleToPlayers: formData.visibleToPlayers,
					imagePath: formData.imagePath
				};

				if (role === 'dm') {
					// Check if campaignState has createMarker method
					if ('createMarker' in campaignState && typeof campaignState.createMarker === 'function') {
						await (campaignState as DMCampaignState).createMarker({
							...markerData,
							authorRole: 'dm'
						});
					} else {
						// Fallback to direct API call
						await campaignState.makeApiRequest('map-markers', 'POST', markerData);
					}
				} else {
					// Check if campaignState has createNote method
					if ('createNote' in campaignState && typeof campaignState.createNote === 'function') {
						await (campaignState as PlayerCampaignState).createNote({
							...markerData,
							authorRole: 'player'
						});
					} else {
						// Fallback to direct API call
						await campaignState.makeApiRequest('map-markers', 'POST', markerData);
					}
				}
			}
			cancelEdit();
		} catch (err) {
			console.error('Failed to save marker:', err);
		} finally {
			submitting = false;
		}
	}

	async function deleteMarker(markerId: number) {
		if (!confirm('Are you sure you want to delete this item?')) return;
		
		deleting = markerId;
		try {
			await campaignState.makeApiRequest(`map-markers/${markerId}`, 'DELETE');
		} catch (err) {
			console.error('Failed to delete marker:', err);
		} finally {
			deleting = null;
		}
	}

	async function handleImageUpload(file: File) {
		if (!file) return;

		// Validate file
		if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
			uploadError = 'Please select a JPEG, PNG, or WebP image';
			return;
		}

		if (file.size > 10 * 1024 * 1024) {
			uploadError = 'File size must be less than 10MB';
			return;
		}

		uploadingImage = true;
		uploadError = '';

		try {
			// If editing existing marker, upload to that marker
			if (editingMarker) {
				const uploadFormData = new FormData();
				uploadFormData.append('image', file);

				const response = await fetch(`/api/campaigns/${campaignData.campaign.slug}/markers/${editingMarker.id}/image`, {
					method: 'POST',
					body: uploadFormData
				});

				const result = await response.json();

				if (!response.ok) {
					throw new Error(result.message || 'Upload failed');
				}

				formData.imagePath = result.imagePath;
			} else {
				// For new markers, we'll need to save the file temporarily or 
				// create the marker first. For now, show an error.
				uploadError = 'Please save the marker first, then add an image';
			}
		} catch (error) {
			uploadError = error instanceof Error ? error.message : 'Upload failed';
		} finally {
			uploadingImage = false;
		}
	}

	async function removeImage() {
		if (!editingMarker) {
			formData.imagePath = null;
			return;
		}

		uploadingImage = true;
		uploadError = '';

		try {
			const response = await fetch(`/api/campaigns/${campaignData.campaign.slug}/markers/${editingMarker.id}/image`, {
				method: 'DELETE'
			});

			const result = await response.json();

			if (!response.ok) {
				throw new Error(result.message || 'Failed to remove image');
			}

			formData.imagePath = null;
		} catch (error) {
			uploadError = error instanceof Error ? error.message : 'Failed to remove image';
		} finally {
			uploadingImage = false;
		}
	}

	function triggerFileInput() {
		fileInput?.click();
	}

	// Determine default tab based on role and content
	let defaultTab = $derived(
		role === 'dm' 
			? (visiblePois.length > 0 ? 'pois' : 'notes')
			: (visiblePois.length > 0 && visibleNotes.length > 0 ? 'pois' : visiblePois.length > 0 ? 'pois' : 'notes')
	);
</script>

<Dialog.Root bind:open {onOpenChange}>
	<Dialog.Content class="max-w-4xl max-h-[90vh] p-0 gap-0">
		<Dialog.Header class="p-6 pb-2">
			<div class="flex items-center justify-between">
				<div class="flex items-center gap-3">
					<Dialog.Title class="text-xl font-semibold">
						Tile {coords.x + 1},{coords.y + 1}
					</Dialog.Title>
					{#if role === 'dm'}
						<Badge variant="secondary">DM View</Badge>
						<Badge variant={isRevealed ? "default" : "outline"} class="text-xs">
							{isRevealed ? 'Visible to players' : 'Hidden from players'}
						</Badge>
					{/if}
				</div>
			</div>
		</Dialog.Header>

		<div class="flex-1 overflow-hidden">
			{#if editingMarker || creatingType}
				<!-- Create/Edit Form -->
				<div class="p-6 space-y-4">
					<div class="flex items-center justify-between">
						<h3 class="text-lg font-medium">
							{editingMarker ? 'Edit' : 'Create'} {formData.type === 'poi' ? 'Point of Interest' : 'Note'}
						</h3>
						<Button variant="ghost" size="sm" onclick={cancelEdit}>
							<X class="w-4 h-4" />
						</Button>
					</div>

					<div class="grid grid-cols-1 md:grid-cols-2 gap-6">
						<!-- Form fields -->
						<div class="space-y-4">
							{#if formData.type === 'poi'}
								<div>
									<label for="title" class="block text-sm font-medium mb-2">Title *</label>
									<input
										id="title"
										type="text"
										bind:value={formData.title}
										class="w-full px-3 py-2 border border-input rounded-md"
										placeholder="Enter location name..."
										disabled={submitting}
									/>
								</div>
							{/if}

							<div>
								<label for="content" class="block text-sm font-medium mb-2">
									{formData.type === 'poi' ? 'Description' : 'Content *'}
								</label>
								<textarea
									id="content"
									bind:value={formData.content}
									rows="4"
									class="w-full px-3 py-2 border border-input rounded-md resize-none"
									placeholder={formData.type === 'poi' ? 'Describe this location...' : 'Write your note...'}
									disabled={submitting}
								></textarea>
							</div>

							{#if role === 'dm' && formData.type === 'poi'}
								<label class="flex items-center space-x-2">
									<input
										id="visibleToPlayers"
										type="checkbox"
										bind:checked={formData.visibleToPlayers}
										class="rounded border-input"
										disabled={submitting}
									/>
									<span class="text-sm">Visible to players</span>
								</label>
							{/if}
						</div>

						<!-- Image upload area -->
						<div class="space-y-4">
							<span class="block text-sm font-medium">Image</span>
							<div class="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6">
								{#if formData.imagePath}
									<div class="space-y-4">
										<div class="w-full h-48 rounded-lg overflow-hidden bg-muted">
											<MarkerImage
												campaignSlug={campaignData.campaign.slug}
												markerId={editingMarker?.id || 0}
												variant="modal"
												alt="Preview"
												class="w-full h-full object-cover"
											/>
										</div>
										<div class="flex space-x-2">
											<Button 
												variant="outline" 
												size="sm" 
												class="flex-1"
												onclick={triggerFileInput}
												disabled={uploadingImage}
											>
												{uploadingImage ? 'Uploading...' : 'Replace Image'}
											</Button>
											<Button 
												variant="outline" 
												size="sm"
												onclick={removeImage}
												disabled={uploadingImage}
											>
												Remove
											</Button>
										</div>
									</div>
								{:else}
									<div class="text-center">
										<div class="w-12 h-12 mx-auto mb-3 rounded-lg bg-muted flex items-center justify-center">
											<Plus class="w-6 h-6 text-muted-foreground" />
										</div>
										<p class="text-sm text-muted-foreground mb-3">
											{editingMarker 
												? `Add an image to enhance this ${formData.type}`
												: `Images can be added after saving the ${formData.type}`
											}
										</p>
										<Button 
											variant="outline" 
											size="sm"
											onclick={triggerFileInput}
											disabled={!editingMarker || uploadingImage}
										>
											{uploadingImage ? 'Uploading...' : 'Upload Image'}
										</Button>
									</div>
								{/if}
							</div>
							
							{#if uploadError}
								<p class="text-sm text-destructive">{uploadError}</p>
							{/if}
							
							<!-- Hidden file input -->
							<input
								bind:this={fileInput}
								type="file"
								accept="image/jpeg,image/png,image/webp"
								class="hidden"
								onchange={(e) => {
									const target = e.target as HTMLInputElement;
									const file = target.files?.[0];
									if (file) {
										handleImageUpload(file);
									}
								}}
							/>
						</div>
					</div>

					<div class="flex justify-end space-x-3 pt-4">
						<Button variant="outline" onclick={cancelEdit} disabled={submitting}>
							Cancel
						</Button>
						<Button onclick={saveMarker} disabled={submitting}>
							{submitting ? 'Saving...' : 'Save'}
						</Button>
					</div>
				</div>
			{:else}
				<!-- Main Content with Tabs -->
				<Tabs.Root value={defaultTab} class="flex-1 flex flex-col">
					<div class="border-b px-6">
						<Tabs.List class="grid w-full grid-cols-2">
							<Tabs.Trigger value="pois" class="flex items-center gap-2">
								<MapPin class="w-4 h-4" />
								{role === 'dm' ? 'Points of Interest' : 'Locations'}
								{#if visiblePois.length > 0}
									<Badge variant="secondary" class="ml-1">{visiblePois.length}</Badge>
								{/if}
							</Tabs.Trigger>
							<Tabs.Trigger value="notes" class="flex items-center gap-2">
								<StickyNote class="w-4 h-4" />
								Notes
								{#if visibleNotes.length > 0}
									<Badge variant="secondary" class="ml-1">{visibleNotes.length}</Badge>
								{/if}
							</Tabs.Trigger>
						</Tabs.List>
					</div>

					<!-- POIs Tab -->
					<Tabs.Content value="pois" class="flex-1 p-6 m-0">
						<div class="flex items-center justify-between mb-4">
							<h3 class="text-lg font-medium">
								{role === 'dm' ? 'Points of Interest' : 'Locations'}
							</h3>
							{#if role === 'dm'}
								<Button onclick={() => startCreate('poi')}>
									<Plus class="w-4 h-4 mr-2" />
									Add Location
								</Button>
							{/if}
						</div>

						{#if visiblePois.length > 0}
							<div class="grid gap-4">
								{#each visiblePois as poi (poi.id)}
									<Card>
										<CardContent class="p-4">
											<div class="flex gap-4">
												<!-- Image -->
												{#if poi.imagePath}
													<div class="flex-shrink-0 w-24 h-24 rounded-lg overflow-hidden bg-muted">
														<MarkerImage
															campaignSlug={campaignData.campaign.slug}
															markerId={poi.id}
															variant="small"
															alt={poi.title || 'POI image'}
															class="w-full h-full object-cover"
														/>
													</div>
												{/if}

												<!-- Content -->
												<div class="flex-1 min-w-0">
													<div class="flex items-start justify-between">
														<div>
															<h4 class="font-medium text-lg">{poi.title || 'Untitled Location'}</h4>
															{#if role === 'dm' && hasVisibility(poi)}
																<div class="flex items-center gap-1 mt-1">
																	{#if poi.visibleToPlayers}
																		<Users class="w-4 h-4 text-green-600" />
																		<span class="text-sm text-green-600">Visible to players</span>
																	{:else}
																		<Eye class="w-4 h-4 text-orange-600" />
																		<span class="text-sm text-orange-600">DM only</span>
																	{/if}
																</div>
															{/if}
														</div>

														{#if role === 'dm'}
															<div class="flex space-x-2">
																<Button variant="ghost" size="sm" onclick={() => startEdit(poi)}>
																	<Edit class="w-4 h-4" />
																</Button>
																<Button variant="ghost" size="sm" onclick={() => deleteMarker(poi.id)} disabled={deleting === poi.id}>
																	<Trash2 class="w-4 h-4" />
																</Button>
															</div>
														{/if}
													</div>
													
													{#if poi.content}
														<p class="text-muted-foreground mt-2">{poi.content}</p>
													{/if}
												</div>
											</div>
										</CardContent>
									</Card>
								{/each}
							</div>
						{:else}
							<div class="text-center py-12">
								<MapPin class="w-12 h-12 mx-auto text-muted-foreground mb-4" />
								<h3 class="text-lg font-medium mb-2">No locations yet</h3>
								<p class="text-muted-foreground mb-4">
									{role === 'dm' 
										? 'Add points of interest to help players explore this area.'
										: 'No locations have been discovered on this tile.'}
								</p>
								{#if role === 'dm'}
									<Button onclick={() => startCreate('poi')}>
										<Plus class="w-4 h-4 mr-2" />
										Add Your First Location
									</Button>
								{/if}
							</div>
						{/if}
					</Tabs.Content>

					<!-- Notes Tab -->
					<Tabs.Content value="notes" class="flex-1 p-6 m-0">
						<div class="flex items-center justify-between mb-4">
							<h3 class="text-lg font-medium">Notes</h3>
							<Button onclick={() => startCreate('note')}>
								<Plus class="w-4 h-4 mr-2" />
								Add Note
							</Button>
						</div>

						{#if visibleNotes.length > 0}
							<div class="grid gap-4">
								{#each visibleNotes as note (note.id)}
									<Card>
										<CardContent class="p-4">
											<div class="flex gap-4">
												<!-- Image -->
												{#if note.imagePath}
													<div class="flex-shrink-0 w-24 h-24 rounded-lg overflow-hidden bg-muted">
														<MarkerImage
															campaignSlug={campaignData.campaign.slug}
															markerId={note.id}
															variant="small"
															alt="Note image"
															class="w-full h-full object-cover"
														/>
													</div>
												{/if}

												<!-- Content -->
												<div class="flex-1 min-w-0">
													<div class="flex items-start justify-between">
														<div class="flex-1">
															<p class="text-foreground">{note.content || 'Empty note'}</p>
															{#if role === 'dm' && hasVisibility(note)}
																<div class="flex items-center gap-1 mt-2">
																	{#if note.visibleToPlayers}
																		<Users class="w-4 h-4 text-green-600" />
																		<span class="text-sm text-green-600">Visible to players</span>
																	{:else}
																		<User class="w-4 h-4 text-primary" />
																		<span class="text-sm text-primary">Player note</span>
																	{/if}
																</div>
															{/if}
														</div>

														{#if role === 'dm'}
															<div class="flex space-x-2">
																<Button variant="ghost" size="sm" onclick={() => startEdit(note)}>
																	<Edit class="w-4 h-4" />
																</Button>
																<Button variant="ghost" size="sm" onclick={() => deleteMarker(note.id)} disabled={deleting === note.id}>
																	<Trash2 class="w-4 h-4" />
																</Button>
															</div>
														{/if}
													</div>
												</div>
											</div>
										</CardContent>
									</Card>
								{/each}
							</div>
						{:else}
							<div class="text-center py-12">
								<StickyNote class="w-12 h-12 mx-auto text-muted-foreground mb-4" />
								<h3 class="text-lg font-medium mb-2">No notes yet</h3>
								<p class="text-muted-foreground mb-4">
									Add notes to remember important details about this tile.
								</p>
								<Button onclick={() => startCreate('note')}>
									<Plus class="w-4 h-4 mr-2" />
									Add Your First Note
								</Button>
							</div>
						{/if}
					</Tabs.Content>
				</Tabs.Root>
			{/if}
		</div>
	</Dialog.Content>
</Dialog.Root>