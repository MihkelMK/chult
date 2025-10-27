<script lang="ts">
	import { Button, buttonVariants } from '$lib/components/ui/button';
	import * as Collapsible from '$lib/components/ui/collapsible/index.js';
	import * as ToggleGroup from '$lib/components/ui/toggle-group/index.js';
	import * as Tooltip from '$lib/components/ui/tooltip';
	import { ChevronDownIcon, ChevronUpIcon, Eye, EyeOff } from '@lucide/svelte';

	interface Props {
		showAlwaysRevealed: boolean;
		showRevealed: boolean;
		showUnrevealed: boolean;
		tileTransparency: string;
		isOpen: boolean;
		onToggleAlwaysRevealed: () => void;
		onToggleRevealed: () => void;
		onToggleUnrevealed: () => void;
		onTransparencyChange: (value: string) => void;
		onToggleOpen: (open: boolean) => void;
	}

	let {
		showAlwaysRevealed,
		showRevealed,
		showUnrevealed,
		tileTransparency,
		isOpen,
		onToggleAlwaysRevealed,
		onToggleRevealed,
		onToggleUnrevealed,
		onTransparencyChange,
		onToggleOpen
	}: Props = $props();
</script>

{#snippet layerControl(name: string, visibleState: boolean, onToggle: () => void)}
	<div class="flex justify-between gap-6 {visibleState ? '' : 'text-muted-foreground'}">
		<div class="flex items-center">
			<Tooltip.Root>
				<Tooltip.Trigger>
					<Button variant="ghost" size="sm" onclick={onToggle} class="cursor-pointer">
						{#if visibleState}
							<Eye class="w-4 h-4" />
						{:else}
							<EyeOff class="w-4 h-4" />
						{/if}
					</Button>
				</Tooltip.Trigger>
				<Tooltip.Content>
					{visibleState ? `Hide ${name}` : `Show ${name}`}
				</Tooltip.Content>
			</Tooltip.Root>
			<p class="font-mono text-xs select-none mt-[0.175em]">{name}</p>
		</div>
	</div>
{/snippet}

<Collapsible.Root
	class="px-1 w-52 rounded-lg border bg-background/95 shadow-xs backdrop-blur-sm"
	open={isOpen}
	onOpenChange={onToggleOpen}
>
	<div class="flex justify-between items-center py-1 pl-2">
		<h4 class="text-sm font-semibold">Layers</h4>
		<Collapsible.Trigger
			class={buttonVariants({ variant: 'ghost', size: 'sm', class: 'w-9 cursor-pointer p-0' })}
		>
			{#if isOpen}
				<ChevronDownIcon />
			{:else}
				<ChevronUpIcon />
			{/if}
			<span class="sr-only">Toggle</span>
		</Collapsible.Trigger>
	</div>
	<Collapsible.Content>
		<div class="flex flex-col py-1 bg-accent">
			{@render layerControl('Always Revealed', showAlwaysRevealed, onToggleAlwaysRevealed)}
			{@render layerControl('Revealed', showRevealed, onToggleRevealed)}
			{@render layerControl('Unrevealed', showUnrevealed, onToggleUnrevealed)}
		</div>

		<!-- Tile Transparency Control -->
		<div class="flex gap-2 justify-between items-center py-1 pl-2">
			<span class="text-xs select-none">Opacity</span>

			<ToggleGroup.Root
				size="sm"
				variant="text"
				type="single"
				value={tileTransparency}
				onValueChange={onTransparencyChange}
			>
				<ToggleGroup.Item
					value="0"
					disabled={tileTransparency === '0'}
					aria-label="Make tiles transparent"
				>
					<span class="w-6 font-mono text-xs text-center">0</span>
				</ToggleGroup.Item>
				<ToggleGroup.Item
					value="0.5"
					disabled={tileTransparency === '0.5'}
					aria-label="Make tiles half transparent"
				>
					<span class="w-6 font-mono text-xs text-center">0.5</span>
				</ToggleGroup.Item>
				<ToggleGroup.Item
					value="1"
					disabled={tileTransparency === '1'}
					aria-label="Make tiles opaque"
				>
					<span class="w-6 font-mono text-xs text-center">1</span>
				</ToggleGroup.Item>
			</ToggleGroup.Root>
		</div>
	</Collapsible.Content>
</Collapsible.Root>
