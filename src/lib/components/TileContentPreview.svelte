<script lang="ts">
	import type { TileCoords, MapMarkerResponse, PlayerMapMarkerResponse } from '$lib/types';
	import MarkerImage from './MarkerImage.svelte';
	import { MapPin, StickyNote, Eye, User, Users } from '@lucide/svelte';
	import * as HoverCard from '$lib/components/ui/hover-card';
	import { Badge } from '$lib/components/ui/badge';
	import { Separator } from '$lib/components/ui/separator';

	interface Props {
		coords: TileCoords;
		markers: (MapMarkerResponse | PlayerMapMarkerResponse)[];
		campaignSlug: string;
		role: 'dm' | 'player';
		children?: any;
	}

	let {
		coords,
		markers,
		campaignSlug,
		role,
		children
	}: Props = $props();

	// Separate POIs and notes
	let pois = $derived(markers.filter((m) => m.type === 'poi'));
	let notes = $derived(markers.filter((m) => m.type === 'note'));

	// Check if marker has visibility field (only for DM markers)
	function hasVisibility(marker: MapMarkerResponse | PlayerMapMarkerResponse): marker is MapMarkerResponse {
		return 'visibleToPlayers' in marker;
	}

	function isVisibleToCurrentRole(marker: MapMarkerResponse | PlayerMapMarkerResponse): boolean {
		if (role === 'dm') return true; // DM sees everything
		if (!hasVisibility(marker)) return true; // Player markers are always visible to players
		return marker.visibleToPlayers;
	}

	// Filter visible markers based on role
	let visiblePois = $derived(pois.filter(isVisibleToCurrentRole));
	let visibleNotes = $derived(notes.filter(isVisibleToCurrentRole));
	let hasContent = $derived(visiblePois.length > 0 || visibleNotes.length > 0);
</script>

{#if hasContent}
	<HoverCard.Root openDelay={300} closeDelay={100}>
		<HoverCard.Trigger>
			{@render children?.()}
		</HoverCard.Trigger>
		
		<HoverCard.Content 
			class="w-80 p-0" 
			side="top" 
			align="center"
			sideOffset={8}
		>
			<!-- Header -->
			<div class="flex items-center justify-between p-3 pb-2">
				<div class="flex items-center gap-2">
					<Badge variant="outline" class="text-xs font-mono">
						Tile {coords.x + 1},{coords.y + 1}
					</Badge>
				</div>
				{#if role === 'dm'}
					<Badge variant="secondary" class="text-xs">
						DM View
					</Badge>
				{/if}
			</div>

			<div class="max-h-64 overflow-y-auto">
				<!-- POIs Section -->
				{#if visiblePois.length > 0}
					<div class="px-3 pb-3">
						<div class="flex items-center gap-2 mb-3">
							<MapPin class="w-4 h-4 text-destructive" />
							<span class="text-sm font-medium">
								{role === 'dm' ? 'Points of Interest' : 'Locations'}
							</span>
							<Badge variant="secondary" class="text-xs ml-auto">
								{visiblePois.length}
							</Badge>
						</div>
						
						<div class="space-y-2">
							{#each visiblePois as poi (poi.id)}
								<div class="flex gap-3 p-2 rounded-md hover:bg-muted/50 transition-colors">
									<!-- Image preview -->
									{#if poi.imagePath}
										<div class="flex-shrink-0 w-10 h-10 rounded-md bg-muted overflow-hidden">
											<MarkerImage
												{campaignSlug}
												markerId={poi.id}
												variant="thumbnail"
												alt={poi.title || 'POI image'}
												class="w-full h-full object-cover"
											>
												{#snippet noImageSlot()}
													<div class="w-full h-full bg-muted flex items-center justify-center">
														<MapPin class="w-4 h-4 text-muted-foreground" />
													</div>
												{/snippet}
											</MarkerImage>
										</div>
									{/if}
									
									<div class="flex-1 min-w-0">
										<div class="flex items-start justify-between gap-2">
											<h4 class="text-sm font-medium leading-tight line-clamp-1">
												{poi.title || 'Untitled Location'}
											</h4>
											{#if role === 'dm' && hasVisibility(poi)}
												<div class="flex-shrink-0">
													{#if poi.visibleToPlayers}
														<Users class="w-3 h-3 text-green-600" />
													{:else}
														<Eye class="w-3 h-3 text-orange-600" />
													{/if}
												</div>
											{/if}
										</div>
										{#if poi.content}
											<p class="text-xs text-muted-foreground line-clamp-2 mt-1">
												{poi.content}
											</p>
										{/if}
									</div>
								</div>
							{/each}
						</div>
					</div>
					
					{#if visibleNotes.length > 0}
						<Separator />
					{/if}
				{/if}

				<!-- Notes Section -->
				{#if visibleNotes.length > 0}
					<div class="px-3 py-3">
						<div class="flex items-center gap-2 mb-3">
							<StickyNote class="w-4 h-4 text-primary" />
							<span class="text-sm font-medium">Notes</span>
							<Badge variant="secondary" class="text-xs ml-auto">
								{visibleNotes.length}
							</Badge>
						</div>
						
						<div class="space-y-2">
							{#each visibleNotes as note (note.id)}
								<div class="flex gap-3 p-2 rounded-md hover:bg-muted/50 transition-colors">
									<!-- Image preview -->
									{#if note.imagePath}
										<div class="flex-shrink-0 w-10 h-10 rounded-md bg-muted overflow-hidden">
											<MarkerImage
												{campaignSlug}
												markerId={note.id}
												variant="thumbnail"
												alt="Note image"
												class="w-full h-full object-cover"
											>
												{#snippet noImageSlot()}
													<div class="w-full h-full bg-muted flex items-center justify-center">
														<StickyNote class="w-4 h-4 text-muted-foreground" />
													</div>
												{/snippet}
											</MarkerImage>
										</div>
									{/if}
									
									<div class="flex-1 min-w-0">
										<div class="flex items-start justify-between gap-2">
											<p class="text-xs text-foreground line-clamp-3 leading-relaxed">
												{note.content || 'Empty note'}
											</p>
											{#if role === 'dm' && hasVisibility(note)}
												<div class="flex-shrink-0">
													{#if note.visibleToPlayers}
														<Users class="w-3 h-3 text-green-600" />
													{:else}
														<User class="w-3 h-3 text-primary" />
													{/if}
												</div>
											{/if}
										</div>
									</div>
								</div>
							{/each}
						</div>
					</div>
				{/if}
			</div>

			<!-- Footer hint -->
			<Separator />
			<div class="px-3 py-2">
				<p class="text-xs text-muted-foreground text-center">
					Click tile for full details
				</p>
			</div>
		</HoverCard.Content>
	</HoverCard.Root>
{:else}
	<!-- If no content, just render children without hover card -->
	{@render children?.()}
{/if}

<style>
	.line-clamp-1 {
		display: -webkit-box;
		-webkit-line-clamp: 1;
		-webkit-box-orient: vertical;
		overflow: hidden;
		line-clamp: 1;
	}
	
	.line-clamp-2 {
		display: -webkit-box;
		-webkit-line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
		line-clamp: 2;
	}
	
	.line-clamp-3 {
		display: -webkit-box;
		-webkit-line-clamp: 3;
		-webkit-box-orient: vertical;
		overflow: hidden;
		line-clamp: 3;
	}
</style>