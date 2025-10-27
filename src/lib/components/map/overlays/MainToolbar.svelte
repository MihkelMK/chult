<script lang="ts">
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import { SheetTrigger } from '$lib/components/ui/sheet';
	import type { GameSessionResponse } from '$lib/types';
	import { Menu, User, Users } from '@lucide/svelte';

	interface Props {
		campaignName?: string;
		userRole: 'player' | 'dm';
		effectiveRole: 'player' | 'dm';
		activeSession: GameSessionResponse | null;
		hasErrors?: boolean;
		selectedCount?: number;
		showSelectedCount?: boolean;
	}

	let {
		campaignName,
		userRole,
		effectiveRole,
		activeSession,
		hasErrors = false,
		selectedCount = 0,
		showSelectedCount = false
	}: Props = $props();
</script>

<div
	class="absolute top-4 left-4 z-20 flex w-[calc(100%_-_calc(var(--spacing)_*_8))] flex-col gap-2"
>
	<div
		class="grid grid-cols-3 items-center p-2 w-full rounded-lg border bg-background/95 shadow-xs backdrop-blur-sm"
	>
		<div class="flex justify-between items-center min-w-80">
			<div class="flex gap-2 items-center">
				<SheetTrigger>
					{#snippet child({ props })}
						<Button {...props} variant="ghost" size="sm">
							<Menu class="w-4 h-4" />
						</Button>
					{/snippet}
				</SheetTrigger>

				<div class="flex gap-2 items-center">
					<div class="text-sm font-medium">
						{campaignName || 'Campaign'}
					</div>
					<Badge variant="secondary" class="text-xs">
						{effectiveRole === 'dm' ? 'DM' : 'Player'}
					</Badge>
				</div>
			</div>

			<div class="flex gap-2 items-center">
				{#if hasErrors}
					<Badge variant="destructive" class="text-xs">Error</Badge>
				{/if}

				{#if showSelectedCount}
					<Badge variant="secondary" class="justify-self-end text-xs">
						{selectedCount} selected
					</Badge>
				{/if}
			</div>
		</div>

		<h2 class="justify-self-center text-sm font-medium">
			{#if activeSession && activeSession.isActive}
				{activeSession.name}
			{:else}
				No active session
			{/if}
		</h2>

		<!-- Navigation Links -->
		{#if userRole === 'dm'}
			<form action="?/toggleView" method="POST" class="contents">
				<Button variant="link" size="sm" type="submit" class="justify-self-end w-fit">
					{#if effectiveRole === 'dm'}
						<Users class="mr-2 w-4 h-4" />
						Player View
					{:else}
						<User class="mr-2 w-4 h-4" />
						DM View
					{/if}
				</Button>
			</form>
		{/if}
	</div>
</div>
