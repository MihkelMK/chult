<script lang="ts">
	import { Badge } from '$lib/components/ui/badge';
	import { Button, buttonVariants } from '$lib/components/ui/button';
	import { Separator } from '$lib/components/ui/separator';
	import { SheetContent, SheetHeader, SheetTitle } from '$lib/components/ui/sheet';
	import GlobalTimeDisplay from './map/overlays/GlobalTimeDisplay.svelte';
	import type { GameSessionResponse, MapMarker } from '$lib/types';
	import { User, Users } from '@lucide/svelte';
	import { enhance } from '$app/forms';

	interface Props {
		effectiveRole: 'player' | 'dm';
		userRole: 'player' | 'dm';
		campaignSlug: string;
		globalGameTime: number;
		revealedTilesCount: number;
		alwaysRevealedTilesCount: number;
		mapMarkers?: MapMarker[];
		hasPendingOperations: boolean;
		pendingCount: number;
		hasActiveSession: boolean;
		activeSession: GameSessionResponse | null;
		sessionDuration: string | null;
		onFlushPending: () => void;
		onStartSession: () => void;
		onEndSession: () => void;
	}

	let {
		effectiveRole,
		userRole,
		campaignSlug,
		globalGameTime,
		revealedTilesCount,
		alwaysRevealedTilesCount,
		mapMarkers = [],
		hasPendingOperations,
		pendingCount,
		hasActiveSession,
		activeSession,
		sessionDuration,
		onFlushPending,
		onStartSession,
		onEndSession
	}: Props = $props();
</script>

<SheetContent side="left" class="w-80">
	<SheetHeader>
		<SheetTitle>
			{effectiveRole === 'dm' ? 'DM Controls' : 'Map Info'}
		</SheetTitle>
	</SheetHeader>

	<div class="flex flex-col justify-between p-6 h-full">
		<div class="space-y-4">
			<!-- Player/DM View Toggle -->
			{#if userRole === 'dm'}
				<div>
					<form action="?/toggleView" method="POST" class="contents" use:enhance>
						<Button variant="outline" size="sm" type="submit" class="w-full">
							{#if effectiveRole === 'dm'}
								<Users class="mr-2 w-4 h-4" />
								Switch to Player View
							{:else}
								<User class="mr-2 w-4 h-4" />
								Switch to DM View
							{/if}
						</Button>
					</form>
				</div>

				<Separator />
			{/if}

			<!-- Statistics -->
			<div>
				<h3 class="mb-3 text-sm font-medium">Statistics</h3>
				<div class="space-y-2">
					<!-- Global Game Time -->
					<div class="flex justify-between text-sm">
						<span class="text-muted-foreground">Game Time</span>
						<GlobalTimeDisplay {globalGameTime} />
					</div>
					<div class="flex justify-between text-sm">
						<span class="text-muted-foreground">Revealed Tiles</span>
						<span class="font-medium">{revealedTilesCount}</span>
					</div>
					<div class="flex justify-between text-sm">
						<span class="text-muted-foreground">Always Revealed Tiles</span>
						<span class="font-medium">{alwaysRevealedTilesCount}</span>
					</div>
					<div class="flex justify-between text-sm">
						<span class="text-muted-foreground">Points of Interest</span>
						<span class="font-medium">
							{mapMarkers.filter((m) => m.type === 'poi').length}
						</span>
					</div>
					<div class="flex justify-between text-sm">
						<span class="text-muted-foreground">Notes</span>
						<span class="font-medium">
							{mapMarkers.filter((m) => m.type === 'note').length}
						</span>
					</div>
					{#if hasPendingOperations}
						<div class="flex justify-between text-sm">
							<span class="text-orange-600">Pending Changes</span>
							<Badge variant="secondary">{pendingCount}</Badge>
						</div>
					{/if}
				</div>
			</div>

			<Separator />

			{#if effectiveRole === 'dm'}
				<!-- DM Controls -->
				<div>
					<h3 class="mb-3 text-sm font-medium">Tile Management</h3>
					<div class="space-y-2">
						<p class="text-sm text-muted-foreground">
							Click any tile to add POI or notes. Use multi-select for bulk reveal/hide operations.
						</p>

						{#if hasPendingOperations}
							<Button variant="outline" size="sm" class="w-full" onclick={onFlushPending}>
								Save {pendingCount} Changes Now
							</Button>
						{/if}
					</div>
				</div>
			{:else}
				<!-- Player Info -->
				<div>
					<h3 class="mb-3 text-sm font-medium">How to Explore</h3>
					<div class="space-y-2 text-sm text-muted-foreground">
						<p>• Click any tile to view details or add notes</p>
						<p>• Revealed tiles show explored territory</p>
						<p>• Look for POI markers on important locations</p>
						<p>• Travel mode coming soon...</p>
					</div>
				</div>
			{/if}

			<!-- Session Controls (DM Only) -->
			<Separator />
			<div>
				{#if hasActiveSession}
					<div class="space-y-4">
						<div class="flex justify-between items-center text-sm">
							<span class="text-muted-foreground">Active Session</span>
							<Badge variant="default" class="text-xs">
								Session {activeSession?.sessionNumber}
							</Badge>
						</div>
						<div class="flex justify-between items-center text-sm">
							<span class="text-muted-foreground">Duration</span>
							<span class="font-medium tabular-nums">{sessionDuration}</span>
						</div>
						{#if effectiveRole === 'dm'}
							<Button
								variant="destructive"
								size="sm"
								class="w-full cursor-pointer"
								onclick={onEndSession}
							>
								End Session
							</Button>
						{/if}
					</div>
				{:else if effectiveRole === 'dm'}
					<Button
						variant="default"
						size="sm"
						class="w-full cursor-pointer"
						onclick={onStartSession}
					>
						Start Session
					</Button>
				{/if}
			</div>
		</div>

		<div class="space-y-2">
			{#if effectiveRole === 'dm'}
				<a
					href="/{campaignSlug}/settings"
					class={buttonVariants({ size: 'sm', variant: 'secondary', class: 'w-full' })}>Settings</a
				>
			{/if}
			<form action="?/logout" method="POST" class="contents" use:enhance>
				<Button variant="link" class="w-full cursor-pointer" size="sm" type="submit">Logout</Button>
			</form>
		</div>
	</div>
</SheetContent>
