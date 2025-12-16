<script lang="ts">
	import DangerIcon from '$lib/components/canvas/icons/DangerIcon.svelte';
	import DungeonIcon from '$lib/components/canvas/icons/DungeonIcon.svelte';
	import GenericIcon from '$lib/components/canvas/icons/GenericIcon.svelte';
	import LandmarkIcon from '$lib/components/canvas/icons/LandmarkIcon.svelte';
	import RestIcon from '$lib/components/canvas/icons/RestIcon.svelte';
	import RuinsIcon from '$lib/components/canvas/icons/RuinsIcon.svelte';
	import SettlementIcon from '$lib/components/canvas/icons/SettlementIcon.svelte';
	import WarningIcon from '$lib/components/canvas/icons/WarningIcon.svelte';
	import { Button } from '$lib/components/ui/button';
	import {
		Dialog,
		DialogContent,
		DialogDescription,
		DialogFooter,
		DialogHeader,
		DialogTitle
	} from '$lib/components/ui/dialog';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Switch } from '$lib/components/ui/switch';
	import { Textarea } from '$lib/components/ui/textarea';
	import { type MarkerType, type TileCoords } from '$lib/types';
	import type { MapMarkerResponse } from '$lib/types/database';
	import { MARKER_TYPES } from '$lib/utils/mapMarkers';
	import { Layer, Stage } from 'svelte-konva';

	interface Props {
		open: boolean;
		coords: TileCoords | null;
		isDM: boolean;
		editingMarker?: MapMarkerResponse | null;
		onConfirm: (data: {
			type: MarkerType;
			title: string;
			content?: string;
			visibleToPlayers: boolean;
		}) => void;
		onCancel: () => void;
	}

	let {
		open = $bindable(),
		coords,
		isDM,
		editingMarker = null,
		onConfirm,
		onCancel
	}: Props = $props();

	// Form state
	let selectedType = $state<MarkerType>('generic');
	let title = $state('');
	let description = $state('');
	let visibleToPlayers = $state(true);

	let isEditMode = $derived(editingMarker !== null);

	// Reset or populate form when dialog opens
	$effect(() => {
		if (open) {
			if (editingMarker) {
				// Edit mode: populate with existing data
				selectedType = editingMarker.type as MarkerType;
				title = editingMarker.title;
				description = editingMarker.content || '';
				visibleToPlayers = editingMarker.visibleToPlayers;
			} else {
				// Create mode: reset to defaults
				selectedType = 'generic';
				title = '';
				description = '';
				visibleToPlayers = !isDM;
			}
		}
	});

	// Marker type metadata
	const markerTypesMeta: Record<MarkerType, { label: string; description: string; color: string }> =
		{
			settlement: {
				label: 'Settlement',
				description: 'City, town, or village',
				color: 'rgb(147, 51, 234)'
			},
			dungeon: {
				label: 'Dungeon',
				description: 'Dungeon, cave, or lair',
				color: 'rgb(75, 85, 99)'
			},
			ruins: {
				label: 'Ruins',
				description: 'Abandoned structures',
				color: 'rgb(217, 119, 6)'
			},
			rest: { label: 'Rest', description: 'Camp, inn, or safe haven', color: 'rgb(249, 115, 22)' },
			landmark: { label: 'Landmark', description: 'Notable location', color: 'rgb(20, 184, 166)' },
			danger: { label: 'Danger', description: 'Hazard or threat', color: 'rgb(239, 68, 68)' },
			warning: { label: 'Warning', description: 'Caution area', color: 'rgb(251, 146, 60)' },
			generic: { label: 'Generic', description: 'General marker', color: 'rgb(107, 114, 128)' },
			custom: {
				label: 'Custom',
				description: 'Custom icon (coming soon)',
				color: 'rgb(59, 130, 246)'
			}
		};

	function handleConfirm() {
		if (!title.trim()) return;

		onConfirm({
			type: selectedType,
			title: title.trim(),
			content: description.trim() || undefined,
			visibleToPlayers
		});

		// Close dialog
		open = false;
	}

	function handleCancel() {
		onCancel();
		open = false;
	}

	// Icon preview size
	const iconSize = 40;
	const iconRadius = iconSize * 0.6;
</script>

<Dialog bind:open>
	<DialogContent class="sm:max-w-[600px]">
		<DialogHeader>
			<DialogTitle>{isEditMode ? 'Edit Marker' : 'Create Marker'}</DialogTitle>
			<DialogDescription>
				{#if isEditMode}
					Edit marker at coordinates ({editingMarker?.x}, {editingMarker?.y})
				{:else}
					Create a new marker at coordinates ({coords?.x}, {coords?.y})
				{/if}
			</DialogDescription>
		</DialogHeader>

		<div class="grid gap-6 py-4">
			<!-- Type selector grid -->
			<div class="grid gap-3">
				<Label>Marker Type</Label>
				<div class="grid grid-cols-3 gap-3">
					{#each MARKER_TYPES.filter((t) => t !== 'custom') as type (type)}
						<button
							type="button"
							class="flex flex-col items-center gap-2 rounded-lg border-2 p-3 transition-all hover:bg-accent {selectedType ===
							type
								? 'border-primary bg-accent'
								: 'border-border'}"
							onclick={() => (selectedType = type)}
						>
							<!-- Konva icon preview -->
							<div class="flex h-[50px] w-[50px] items-center justify-center">
								<Stage width={50} height={50}>
									<Layer>
										{#if type === 'settlement'}
											<SettlementIcon
												x={25}
												y={25}
												radius={iconRadius}
												color={markerTypesMeta[type].color}
											/>
										{:else if type === 'dungeon'}
											<DungeonIcon
												x={25}
												y={25}
												radius={iconRadius}
												color={markerTypesMeta[type].color}
											/>
										{:else if type === 'ruins'}
											<RuinsIcon
												x={25}
												y={25}
												radius={iconRadius}
												color={markerTypesMeta[type].color}
											/>
										{:else if type === 'rest'}
											<RestIcon
												x={25}
												y={25}
												radius={iconRadius}
												color={markerTypesMeta[type].color}
											/>
										{:else if type === 'landmark'}
											<LandmarkIcon
												x={25}
												y={25}
												radius={iconRadius}
												color={markerTypesMeta[type].color}
											/>
										{:else if type === 'danger'}
											<DangerIcon
												x={25}
												y={25}
												radius={iconRadius}
												color={markerTypesMeta[type].color}
											/>
										{:else if type === 'warning'}
											<WarningIcon
												x={25}
												y={25}
												radius={iconRadius}
												color={markerTypesMeta[type].color}
											/>
										{:else if type === 'generic'}
											<GenericIcon
												x={25}
												y={25}
												radius={iconRadius}
												color={markerTypesMeta[type].color}
											/>
										{/if}
									</Layer>
								</Stage>
							</div>

							<div class="text-center">
								<div class="text-sm font-medium">{markerTypesMeta[type].label}</div>
								<div class="text-xs text-muted-foreground">
									{markerTypesMeta[type].description}
								</div>
							</div>
						</button>
					{/each}
				</div>
			</div>

			<!-- Title input -->
			<div class="grid gap-2">
				<Label for="title">
					Name <span class="text-destructive">*</span>
				</Label>
				<Input
					id="title"
					type="text"
					placeholder="Enter marker name..."
					bind:value={title}
					required
					class="col-span-3"
				/>
			</div>

			<!-- Description textarea -->
			<div class="grid gap-2">
				<Label for="description">Description (optional)</Label>
				<Textarea
					id="description"
					placeholder="Enter additional details..."
					bind:value={description}
					rows={3}
					class="col-span-3"
				/>
			</div>

			<!-- Visibility toggle (DM only) -->
			{#if isDM}
				<div class="flex items-center justify-between">
					<div class="space-y-0.5">
						<Label for="visibility">Visible to Players</Label>
						<div class="text-sm text-muted-foreground">
							Players will see this marker on their map
						</div>
					</div>
					<Switch id="visibility" bind:checked={visibleToPlayers} />
				</div>
			{/if}
		</div>

		<DialogFooter>
			<Button variant="outline" onclick={handleCancel}>Cancel</Button>
			<Button onclick={handleConfirm} disabled={!title.trim()}>
				{isEditMode ? 'Save Changes' : 'Create Marker'}
			</Button>
		</DialogFooter>
	</DialogContent>
</Dialog>
