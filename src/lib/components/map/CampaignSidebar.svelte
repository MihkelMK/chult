<script lang="ts">
	import { enhance } from '$app/forms';
	import TimeAdjustmentDialog from '$lib/components/dialogs/TimeAdjustmentDialog.svelte';
	import TimeAuditDialog from '$lib/components/dialogs/TimeAuditDialog.svelte';
	import ViewAsToggle from '$lib/components/forms/ViewAsToggle.svelte';
	import GlobalTimeDisplay from '$lib/components/map/overlays/GlobalTimeDisplay.svelte';
	import { Badge } from '$lib/components/ui/badge';
	import { Button, buttonVariants } from '$lib/components/ui/button';
	import { ScrollArea } from '$lib/components/ui/scroll-area';
	import { Separator } from '$lib/components/ui/separator';
	import { SheetContent, SheetHeader, SheetTitle } from '$lib/components/ui/sheet';
	import { getLocalState, getRemoteState } from '$lib/contexts/campaignContext';
	import type {
		DialogConfig,
		GameSessionResponse,
		MapMarker,
		TimeAuditLogResponse
	} from '$lib/types';
	import { toast } from 'svelte-sonner';

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
		showDialog: boolean;
		dialogConfig: DialogConfig;
		onFlushPending: () => void;
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
		showDialog = $bindable(),
		dialogConfig = $bindable(),
		onFlushPending
	}: Props = $props();

	let toggleForm: HTMLFormElement | undefined = $state();

	const remoteState = getRemoteState();
	const localState = getLocalState();

	async function handleStartSession() {
		if (effectiveRole === 'dm' && 'startSession' in remoteState) {
			try {
				await remoteState.startSession();
				toast.success('Session started');
			} catch (error) {
				console.error('Failed to start session:', error);
				toast.error('Failed to start session');
			}
		}
	}

	function showEndSessionConfirmation(sessionId: number, durationSeconds: number) {
		dialogConfig = {
			title: 'End Short Session?',
			description: `This session has only been active for ${Math.floor(durationSeconds)} seconds. Would you like to end it or delete it?`,
			actions: [
				{
					label: 'Cancel',
					variant: 'outline',
					action: () => {}
				},
				{
					label: 'Delete Session',
					variant: 'destructive',
					action: async () => {
						try {
							if ('deleteSession' in remoteState) {
								await remoteState.deleteSession(sessionId);
								toast.success('Session deleted');
							}
						} catch (error) {
							console.error('Failed to delete session:', error);
							toast.error('Failed to delete session');
						}
					}
				},
				{
					label: 'End Session',
					variant: 'default',
					action: async () => {
						try {
							if ('endSession' in remoteState) {
								await remoteState.endSession();
								toast.success('Session ended');
							}
						} catch (error) {
							console.error('Failed to end session:', error);
							toast.error('Failed to end session');
						}
					}
				}
			]
		};
		showDialog = true;
	}

	async function handleEndSession() {
		if (effectiveRole === 'dm' && 'endSession' in remoteState) {
			const activeSession = localState.activeSession;
			if (!activeSession) return;

			// Calculate session duration in minutes
			const now = new Date();
			const startTime = new Date(activeSession.startedAt);
			const durationMinutes = (now.getTime() - startTime.getTime()) / 60000;

			// If session is less than 1 minute, ask if they want to delete it
			if (durationMinutes < 1) {
				showEndSessionConfirmation(activeSession.id, durationMinutes * 60);
			} else {
				// Session is longer than 1 minute, end it directly
				try {
					await remoteState.endSession();
					toast.success('Session ended');
				} catch (error) {
					console.error('Failed to end session:', error);
					toast.error('Failed to end session');
				}
			}
		}
	}

	async function handleAdjustTime(delta: number, notes: string) {
		if (effectiveRole === 'dm' && 'adjustGlobalTime' in remoteState) {
			try {
				await remoteState.adjustGlobalTime(delta, notes);
				toast.success(`Time adjusted by ${delta > 0 ? '+' : ''}${delta} days`);
			} catch (error) {
				console.error('Failed to adjust time:', error);
				toast.error('Failed to adjust time');
			}
		}
	}
</script>

<SheetContent side="left" class="flex h-full w-80 flex-col p-0">
	<SheetHeader class="shrink-0 px-6 pt-6">
		<SheetTitle>
			{effectiveRole === 'dm' ? 'DM Controls' : 'Map Info'}
		</SheetTitle>
	</SheetHeader>

	<!-- Scrollable Content -->
	<div class="flex-1 overflow-hidden">
		<ScrollArea class="h-full px-6">
			<div class="space-y-4 pb-4">
				<!-- Player/DM View Toggle -->
				{#if userRole === 'dm'}
					<div class="flex items-center justify-between">
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
							<div class="flex items-center justify-between text-sm">
								<span class="text-muted-foreground">Active Session</span>
								<Badge variant="default" class="text-xs">
									Session {activeSession?.sessionNumber}
								</Badge>
							</div>
							<div class="flex items-center justify-between text-sm">
								<span class="text-muted-foreground">Duration</span>
								<span class="font-medium tabular-nums">{sessionDuration}</span>
							</div>
							{#if effectiveRole === 'dm'}
								<Button
									variant="destructive"
									size="sm"
									class="w-full cursor-pointer"
									onclick={handleEndSession}
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
							onclick={handleStartSession}
						>
							Start Session
						</Button>
					{/if}
				</div>

				<!-- Time Management (DM Only) -->
				{#if effectiveRole === 'dm'}
					<Separator />
					<div class="space-y-3">
						<h3 class="text-sm font-medium">Time Management</h3>

						<div class="flex justify-between">
							<!-- Adjust Time Button/Dialog -->
							<TimeAdjustmentDialog onAdjustTime={handleAdjustTime} />

							<!-- Time Audit Log -->
							<TimeAuditDialog {timeAuditLog} {globalGameTime} />
						</div>
					</div>
				{/if}
			</div>
		</ScrollArea>
	</div>

	<!-- Fixed Footer -->
	<div class="shrink-0 space-y-2 border-t p-6">
		{#if effectiveRole === 'dm'}
			<a
				href="/{campaignSlug}/settings"
				class={buttonVariants({ size: 'sm', variant: 'secondary', class: 'w-full' })}
			>
				Settings
			</a>
		{/if}
		<form action="?/logout" method="POST" class="contents" use:enhance>
			<Button variant="link" class="w-full cursor-pointer" size="sm" type="submit">Logout</Button>
		</form>
	</div>
</SheetContent>
