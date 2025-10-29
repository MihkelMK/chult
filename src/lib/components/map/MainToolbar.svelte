<script lang="ts">
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import { SheetTrigger } from '$lib/components/ui/sheet';
	import * as Tooltip from '$lib/components/ui/tooltip';
	import type { GameSessionResponse } from '$lib/types';
	import { Clock, Menu } from '@lucide/svelte';

	interface Props {
		campaignName?: string;
		effectiveRole: 'player' | 'dm';
		activeSession: GameSessionResponse | null;
		hasErrors?: boolean;
		selectedCount?: number;
		showSelectedCount?: boolean;
		partyTokenPosition?: { x: number; y: number } | null;
		onOpenHistory?: () => void;
		onPanToParty?: () => void;
	}

	let {
		campaignName,
		effectiveRole,
		activeSession,
		hasErrors = false,
		selectedCount = 0,
		showSelectedCount = false,
		partyTokenPosition,
		onOpenHistory,
		onPanToParty
	}: Props = $props();
</script>

<div
	class="absolute top-4 left-4 z-20 flex w-[calc(100%_-_calc(var(--spacing)_*_8))] flex-col gap-2"
>
	<div
		class="grid grid-cols-3 items-center p-2 w-full rounded-lg border bg-background/95 shadow-xs backdrop-blur-sm"
	>
		<div class="flex items-center">
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
		</div>

		<div class="flex gap-2 justify-self-center items-center">
			{#if hasErrors}
				<Badge variant="destructive" class="text-xs">Error</Badge>
			{/if}

			{#if showSelectedCount}
				<Badge variant="secondary" class="justify-self-end text-xs">
					{selectedCount} selected
				</Badge>
			{:else if effectiveRole === 'player' && partyTokenPosition}
				<Tooltip.Root>
					<Tooltip.Trigger>
						{#snippet child({ props })}
							<button {...props} onclick={onPanToParty} class="transition-opacity hover:opacity-80">
								<Badge variant="secondary" class="justify-self-end text-xs cursor-pointer">
									Party at: {partyTokenPosition.x.toString().padStart(2, '0')}{partyTokenPosition.y
										.toString()
										.padStart(2, '0')}
								</Badge>
							</button>
						{/snippet}
					</Tooltip.Trigger>
					<Tooltip.Content side="bottom">Click to pan to party token</Tooltip.Content>
				</Tooltip.Root>
			{/if}
		</div>

		<div class="flex justify-self-end items-center">
			<div class="flex gap-2 items-center">
				<div class="flex gap-2 items-center">
					<div class="text-sm font-medium">
						{#if activeSession && activeSession.isActive}
							{activeSession.name}
						{:else}
							Session not active
						{/if}
					</div>
				</div>

				<!-- History Button -->
				<Button variant="ghost" size="sm" onclick={onOpenHistory}>
					<Clock class="w-4 h-4" />
				</Button>
			</div>
		</div>
	</div>
</div>
