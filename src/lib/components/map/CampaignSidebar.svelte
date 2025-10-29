<script lang="ts">
	import { enhance } from '$app/forms';
	import GlobalTimeDisplay from '$lib/components/map/overlays/GlobalTimeDisplay.svelte';
	import TimeAdjustmentDialog from '$lib/components/map/overlays/TimeAdjustmentDialog.svelte';
	import TimeAuditLog from '$lib/components/map/overlays/TimeAuditLog.svelte';
	import ViewAsToggle from '$lib/components/map/overlays/ViewAsToggle.svelte';
	import { Badge } from '$lib/components/ui/badge';
	import { Button, buttonVariants } from '$lib/components/ui/button';
	import { ScrollArea } from '$lib/components/ui/scroll-area';
	import { Separator } from '$lib/components/ui/separator';
	import { SheetContent, SheetHeader, SheetTitle } from '$lib/components/ui/sheet';
	import type { GameSessionResponse, MapMarker, TimeAuditLogResponse } from '$lib/types';

	interface Props {
		effectiveRole: 'player' | 'dm';
		userRole: 'player' | 'dm';
		campaignSlug: string;
		globalGameTime: number;
		revealedTilesCount: number;
		alwaysRevealedTilesCount: number;
		mapMarkers?: MapMarker[];
		timeAuditLog?: TimeAuditLogResponse[];
		hasPendingOperations: boolean;
		pendingCount: number;
		hasActiveSession: boolean;
		activeSession: GameSessionResponse | null;
		sessionDuration: string | null;
		onFlushPending: () => void;
		onStartSession: () => void;
		onEndSession: () => void;
		onAdjustTime?: (delta: number, notes: string) => void;
	}

	let {
		effectiveRole,
		userRole,
		campaignSlug,
		globalGameTime,
		revealedTilesCount,
		alwaysRevealedTilesCount,
		mapMarkers = [],
		timeAuditLog = [],
		hasPendingOperations,
		pendingCount,
		hasActiveSession,
		activeSession,
		sessionDuration,
		onFlushPending,
		onStartSession,
		onEndSession,
		onAdjustTime
	}: Props = $props();

	let toggleForm: HTMLFormElement | undefined = $state();
</script>

<SheetContent side="left" class="flex flex-col p-0 w-80 h-full">
	<SheetHeader class="flex-shrink-0 px-6 pt-6">
		<SheetTitle>
			{effectiveRole === 'dm' ? 'DM Controls' : 'Map Info'}
		</SheetTitle>
	</SheetHeader>

	<!-- Scrollable Content -->
	<div class="overflow-hidden flex-1">
		<ScrollArea class="px-6 h-full">
			<div class="pb-4 space-y-4">
				<!-- Player/DM View Toggle -->
				{#if userRole === 'dm'}
					<div class="flex justify-between items-center">
						<p class="-mt-0.5">View as:</p>
						<form action="?/toggleView" method="POST" bind:this={toggleForm}>
							<ViewAsToggle {effectiveRole} onCheckedChange={() => toggleForm?.submit()} />
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
						<h3 class="mb-3 text-sm font-medium">DM Tools</h3>
						<ul class="my-4 ml-6 list-disc text-sm text-muted-foreground [&>li]:mt-2">
							<li>Use Select/Paint tools for bulk reveal/hide</li>
							<li>Right-click party token to teleport</li>
							<li class="italic">Points of Interest and notes coming soon...</li>
						</ul>

						{#if hasPendingOperations}
							<Button variant="outline" size="sm" class="w-full" onclick={onFlushPending}>
								Save {pendingCount} Changes Now
							</Button>
						{/if}
					</div>
				{:else}
					<!-- Player Info -->
					<div>
						<h3 class="mb-3 text-sm font-medium">How to Explore</h3>
						<ul class="my-4 ml-6 list-disc text-sm text-muted-foreground [&>li]:mt-2">
							<li>Wait for the DM to start a session</li>
							<li>Use the Explore tool to move between adjacent tiles</li>
							<li>Each move takes 0.5 days of game time</li>
							<li>Revealed tiles show your party's explored territory</li>
							<li class="italic">Points of Interest and notes coming soon...</li>
						</ul>
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

				<!-- Time Management (DM Only) -->
				{#if effectiveRole === 'dm' && onAdjustTime}
					<Separator />
					<div class="space-y-3">
						<h3 class="text-sm font-medium">Time Management</h3>

						<div class="flex justify-between">
							<!-- Adjust Time Button/Dialog -->
							<TimeAdjustmentDialog {onAdjustTime} />

							<!-- Time Audit Log -->
							<TimeAuditLog {timeAuditLog} {globalGameTime} />
						</div>
					</div>
				{/if}
			</div>
		</ScrollArea>
	</div>

	<!-- Fixed Footer -->
	<div class="flex-shrink-0 p-6 space-y-2 border-t">
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
</SheetContent>
