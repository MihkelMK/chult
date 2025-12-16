<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Separator } from '$lib/components/ui/separator';
	import { Slider } from '$lib/components/ui/slider';
	import * as Tooltip from '$lib/components/ui/tooltip';
	import type { SelectMode } from '$lib/types';
	import { Eye, EyeOff, Lock, Minus, Plus, Trash2 } from '@lucide/svelte';

	interface Props {
		alwaysRevealMode: boolean;
		activeSelectMode: SelectMode;
		selectedSelectMode: SelectMode;
		selectedCount: number;
		showBrushSize?: boolean;
		brushSize?: number;
		onReveal: () => void;
		onHide: () => void;
		onClear: () => void;
	}

	let {
		brushSize = $bindable(),
		alwaysRevealMode = $bindable(),
		selectedSelectMode = $bindable(),
		activeSelectMode,
		selectedCount,
		showBrushSize = false,
		onReveal,
		onHide,
		onClear
	}: Props = $props();
</script>

<div class="flex gap-1 rounded-lg border bg-background/95 p-1 shadow-xs backdrop-blur-sm">
	<div class="flex items-center gap-1">
		<!-- Always-Reveal Toggle -->
		<Tooltip.Root>
			<Tooltip.Trigger>
				<Button
					variant={alwaysRevealMode ? 'default' : 'ghost'}
					size="sm"
					class="cursor-pointer"
					onclick={() => (alwaysRevealMode = !alwaysRevealMode)}
				>
					<Lock class="h-4 w-4" />
				</Button>
			</Tooltip.Trigger>
			<Tooltip.Content>
				{alwaysRevealMode ? 'Always Reveal: ON' : 'Always Reveal: OFF'}
			</Tooltip.Content>
		</Tooltip.Root>

		<Separator orientation="vertical" class="!h-6" />

		<!-- Add/Remove Mode Toggle -->
		<Tooltip.Root>
			<Tooltip.Trigger>
				<Button
					variant={activeSelectMode === 'add' ? 'default' : 'ghost'}
					size="sm"
					class="cursor-pointer"
					onclick={() => (selectedSelectMode = 'add')}
				>
					<Plus class="h-4 w-4" />
				</Button>
			</Tooltip.Trigger>
			<Tooltip.Content>Add to selection</Tooltip.Content>
		</Tooltip.Root>

		<Tooltip.Root>
			<Tooltip.Trigger>
				<Button
					variant={activeSelectMode === 'remove' ? 'default' : 'ghost'}
					size="sm"
					class="cursor-pointer"
					onclick={() => (selectedSelectMode = 'remove')}
				>
					<Minus class="h-4 w-4" />
				</Button>
			</Tooltip.Trigger>
			<Tooltip.Content>Remove from selection</Tooltip.Content>
		</Tooltip.Root>

		<Separator orientation="vertical" class="!h-6" />

		<!-- Action Buttons -->
		<Tooltip.Root>
			<Tooltip.Trigger>
				<Button
					disabled={selectedCount === 0}
					variant="ghost"
					size="sm"
					class="cursor-pointer"
					onclick={onReveal}
				>
					<Eye class="h-4 w-4" />
				</Button>
			</Tooltip.Trigger>
			<Tooltip.Content>Reveal Selected</Tooltip.Content>
		</Tooltip.Root>

		<Tooltip.Root>
			<Tooltip.Trigger>
				<Button
					disabled={selectedCount === 0}
					variant="ghost"
					size="sm"
					class="cursor-pointer"
					onclick={onHide}
				>
					<EyeOff class="h-4 w-4" />
				</Button>
			</Tooltip.Trigger>
			<Tooltip.Content>Hide Selected</Tooltip.Content>
		</Tooltip.Root>

		<Tooltip.Root>
			<Tooltip.Trigger>
				<Button
					disabled={selectedCount === 0}
					variant="ghost"
					size="sm"
					class="cursor-pointer"
					onclick={onClear}
				>
					<Trash2 class="h-4 w-4" />
				</Button>
			</Tooltip.Trigger>
			<Tooltip.Content>Clear Selection</Tooltip.Content>
		</Tooltip.Root>
	</div>

	<!-- Brush Size Slider -->
	{#if showBrushSize}
		<div class="flex items-center gap-2">
			<div class="flex items-center gap-2 px-2">
				<span class="text-xs text-muted-foreground">Brush Size:</span>
				<div class="w-20">
					<Slider type="single" bind:value={brushSize} min={1} max={5} step={1} class="w-full" />
				</div>
				<span class="w-6 text-center font-mono text-xs">{brushSize}</span>
			</div>
		</div>
	{/if}
</div>
