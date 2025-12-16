<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import {
		Dialog,
		DialogContent,
		DialogDescription,
		DialogFooter,
		DialogHeader,
		DialogTitle
	} from '$lib/components/ui/dialog';
	import type { UserRole } from '$lib/types';
	import type { MapMarkerResponse } from '$lib/types/database';

	interface Props {
		open: boolean;
		marker: MapMarkerResponse | null;
		userRole: UserRole;
		canEdit: boolean;
		onEdit: () => void;
		onDelete: () => void;
		onClose: () => void;
	}

	let {
		open = $bindable(),
		marker,
		userRole,
		canEdit,
		onEdit,
		onDelete,
		onClose
	}: Props = $props();

	// Marker type metadata for badge display
	const markerTypesMeta: Record<string, { label: string; color: string; bgColor: string }> = {
		settlement: {
			label: 'Settlement',
			color: 'rgb(147, 51, 234)',
			bgColor: 'rgba(147, 51, 234, 0.1)'
		},
		dungeon: { label: 'Dungeon', color: 'rgb(75, 85, 99)', bgColor: 'rgba(75, 85, 99, 0.1)' },
		ruins: { label: 'Ruins', color: 'rgb(217, 119, 6)', bgColor: 'rgba(217, 119, 6, 0.1)' },
		rest: { label: 'Rest', color: 'rgb(249, 115, 22)', bgColor: 'rgba(249, 115, 22, 0.1)' },
		landmark: {
			label: 'Landmark',
			color: 'rgb(20, 184, 166)',
			bgColor: 'rgba(20, 184, 166, 0.1)'
		},
		danger: { label: 'Danger', color: 'rgb(239, 68, 68)', bgColor: 'rgba(239, 68, 68, 0.1)' },
		warning: { label: 'Warning', color: 'rgb(251, 146, 60)', bgColor: 'rgba(251, 146, 60, 0.1)' },
		generic: { label: 'Generic', color: 'rgb(107, 114, 128)', bgColor: 'rgba(107, 114, 128, 0.1)' },
		custom: { label: 'Custom', color: 'rgb(59, 130, 246)', bgColor: 'rgba(59, 130, 246, 0.1)' }
	};

	let typeMeta = $derived(
		marker
			? markerTypesMeta[marker.type] || {
					label: marker.type,
					color: 'rgb(107, 114, 128)',
					bgColor: 'rgba(107, 114, 128, 0.1)'
				}
			: null
	);
</script>

{#if marker}
	<Dialog bind:open>
		<DialogContent class="sm:max-w-[500px]">
			<DialogHeader>
				<div class="flex items-start gap-3">
					<div class="flex flex-1 items-center gap-4">
						<DialogTitle>{marker.title}</DialogTitle>
						{#if typeMeta}
							<div
								class="inline-flex items-center gap-2 rounded-md px-2 py-1 text-xs font-medium"
								style="color: {typeMeta.color}; background-color: {typeMeta.bgColor};"
							>
								{typeMeta.label}
							</div>
						{/if}
					</div>
				</div>
				<DialogDescription class="space-y-1">
					{@const xString = marker.x.toString().padStart(2, '0')}
					{@const yString = marker.y.toString().padStart(2, '0')}
					<p>
						Location: {xString}{yString}
					</p>
					{#if userRole === 'dm' && !marker.visibleToPlayers}
						<p class="text-muted-foreground">(Hidden from players)</p>
					{/if}
				</DialogDescription>
			</DialogHeader>

			{#if marker.content}
				<div class="py-4">
					<p class="text-sm whitespace-pre-wrap">{marker.content}</p>
				</div>
			{/if}

			<DialogFooter>
				<div class="flex w-full justify-between">
					<Button variant="ghost" class="cursor-pointer" onclick={onClose}>Close</Button>
					{#if canEdit}
						<div>
							<Button variant="outline" class="cursor-pointer" onclick={onEdit}>Edit</Button>
							<Button variant="destructive" class="cursor-pointer" onclick={onDelete}>
								Delete
							</Button>
						</div>
					{/if}
				</div>
			</DialogFooter>
		</DialogContent>
	</Dialog>
{/if}
