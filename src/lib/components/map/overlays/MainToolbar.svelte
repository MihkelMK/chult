<script lang="ts">
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import { SheetTrigger } from '$lib/components/ui/sheet';
	import { Menu } from '@lucide/svelte';

	interface Props {
		campaignName?: string;
		mode: 'player' | 'dm';
		hasErrors?: boolean;
		errorMessage?: string | null;
		selectedCount?: number;
		showSelectedCount?: boolean;
	}

	let {
		campaignName,
		mode,
		hasErrors = false,
		errorMessage,
		selectedCount = 0,
		showSelectedCount = false
	}: Props = $props();
</script>

<div
	class="flex justify-between items-center p-2 rounded-lg border min-w-80 bg-background/95 shadow-xs backdrop-blur-sm"
>
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
				{mode === 'dm' ? 'DM' : 'Player'}
			</Badge>
		</div>
	</div>

	<div class="flex gap-2 items-center">
		{#if hasErrors}
			<Badge variant="destructive" class="text-xs">Error</Badge>
		{/if}

		{#if errorMessage}
			<Badge variant="destructive" class="text-xs">
				{errorMessage}
			</Badge>
		{/if}
		{#if showSelectedCount}
			<Badge variant="secondary" class="justify-self-end text-xs">
				{selectedCount} selected
			</Badge>
		{/if}
	</div>
</div>
