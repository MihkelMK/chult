<script lang="ts">
	import { SheetContent, SheetHeader, SheetTitle } from '$lib/components/ui/sheet';
	import SessionListItem from './SessionListItem.svelte';
	import type { GameSessionResponse, Path } from '$lib/types';
	import { SvelteMap } from 'svelte/reactivity';

	interface Props {
		sessions: GameSessionResponse[];
		pathsMap: SvelteMap<number, Path>;
		activeSessionId: number | null;
		visibleSessionIds: Set<number>;
		onToggleVisibility: (sessionId: number) => void;
	}

	let { sessions, pathsMap, activeSessionId, visibleSessionIds, onToggleVisibility }: Props =
		$props();

	// Sort sessions by session number (newest first)
	let sortedSessions = $derived(sessions.slice().sort((a, b) => b.sessionNumber - a.sessionNumber));
</script>

<SheetContent side="right" class="w-96">
	<SheetHeader>
		<SheetTitle>Session History</SheetTitle>
	</SheetHeader>

	<div class="overflow-y-auto p-6 space-y-3 h-full">
		{#if sortedSessions.length === 0}
			<div class="py-8 text-sm text-center text-muted-foreground">
				<p>No sessions yet</p>
				<p class="mt-2 text-xs">DM can start a session to begin tracking exploration</p>
			</div>
		{:else}
			{#each sortedSessions as session (session.id)}
				<SessionListItem
					{session}
					path={pathsMap.get(session.id) || null}
					isActive={session.id === activeSessionId}
					isVisible={visibleSessionIds.has(session.id)}
					{onToggleVisibility}
				/>
			{/each}
		{/if}
	</div>
</SheetContent>
