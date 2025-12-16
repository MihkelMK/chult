<script lang="ts">
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import * as Collapsible from '$lib/components/ui/collapsible';
	import type { GameSessionResponse, Path, PathStep } from '$lib/types';
	import { ChevronDown, Eye, EyeOff } from '@lucide/svelte';

	interface Props {
		session: GameSessionResponse;
		path: Path | null;
		isActive: boolean;
		isVisible: boolean;
		activeSessionDuration: string | null;
		activeSessionGametime: number;
		onToggleVisibility: (sessionId: number) => void;
	}

	let {
		session,
		path,
		isActive,
		isVisible,
		activeSessionDuration,
		activeSessionGametime,
		onToggleVisibility
	}: Props = $props();

	let open = $state(isActive); // Active session expanded by default

	function formatDuration(durationMinutes: number | null): string {
		if (!durationMinutes) return '0m';
		const hours = Math.floor(durationMinutes / 60);
		const minutes = Math.floor(durationMinutes % 60);
		return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
	}

	function formatGameTime(days: number): string {
		const months = Math.floor(days / 30);
		const weeks = Math.floor((days % 30) / 7);
		const remainingDays = Math.floor(days % 7);

		const parts: string[] = [];
		if (months > 0) parts.push(`${months}mo`);
		if (weeks > 0) parts.push(`${weeks}w`);
		if (remainingDays > 0) parts.push(`${remainingDays}d`);

		return parts.join(' ') || '0d';
	}

	function formatStepDisplay(step: PathStep): string {
		switch (step.type) {
			case 'player_move':
				return `→ ${step.tileKey.replace('-', '')}`;
			case 'dm_teleport':
				return `⚡ ${step.fromTile.replace('-', '')} → ${step.toTile.replace('-', '')}`;
			case 'dm_path': {
				const tiles = step.tiles.slice(0, 3).join(' → ');
				const more = step.tiles.length > 3 ? ` ... (+${step.tiles.length - 3})` : '';
				return `🛤️ ${tiles}${more}`;
			}
			default:
				return 'Unknown';
		}
	}
</script>

<Collapsible.Root bind:open>
	<div class="rounded-lg border p-2">
		<!-- Header -->
		<div class="flex items-center justify-between gap-2">
			<Collapsible.Trigger class="flex flex-1 items-center gap-2 text-left hover:opacity-70">
				<ChevronDown class="h-4 w-4 transition-transform {open ? '' : '-rotate-90'}" />
				<div class="flex-1">
					<div class="text-sm font-medium">
						{session.name}
						{#if isActive}
							<Badge variant="default" class="ml-2 text-xs">Active</Badge>
						{/if}
					</div>
				</div>
			</Collapsible.Trigger>

			<!-- Visibility Toggle -->
			<Button
				variant="ghost"
				size="sm"
				onclick={() => onToggleVisibility(session.id)}
				class="h-8 w-8 p-0"
			>
				{#if isVisible}
					<Eye class="h-4 w-4" />
				{:else}
					<EyeOff class="h-4 w-4 text-muted-foreground" />
				{/if}
			</Button>
		</div>

		<!-- Collapsible Content -->
		<Collapsible.Content>
			<div class="space-y-3 pt-2 pl-6">
				<!-- Stats -->
				<div class="grid grid-cols-2 gap-2 text-xs">
					<div>
						<span class="text-muted-foreground">Steps:</span>
						<span class="ml-1 font-medium">{path?.steps.length || 0}</span>
					</div>
					<div>
						<span class="text-muted-foreground">New Tiles:</span>
						<span class="ml-1 font-medium">{path?.revealedTiles.length || 0}</span>
					</div>
					<div>
						<span class="text-muted-foreground">Game Time:</span>
						<span class="ml-1 font-medium">
							{formatGameTime(
								isActive
									? activeSessionGametime
									: (session.endGameTime || 0) - session.startGameTime
							)}
						</span>
					</div>
					<div>
						<span class="text-muted-foreground">Duration:</span>
						<span class="ml-1 font-medium">
							{#if isActive}
								{activeSessionDuration}
							{:else}
								{formatDuration(session.duration)}
							{/if}
						</span>
					</div>
				</div>

				<!-- Path Steps -->
				{#if path && path.steps.length > 0}
					<div>
						<div class="mb-1 text-xs text-muted-foreground">Path:</div>
						<div class="space-y-1">
							{#each path.steps as step, index (`${session.id}-step${index}`)}
								<div class="border-l-2 border-muted pl-2 font-mono text-xs">
									<span class="text-muted-foreground">{index + 1}.</span>
									{formatStepDisplay(step)}
								</div>
							{/each}
						</div>
					</div>
				{:else}
					<div class="text-xs text-muted-foreground italic">No movement recorded</div>
				{/if}
			</div>
		</Collapsible.Content>
	</div>
</Collapsible.Root>
