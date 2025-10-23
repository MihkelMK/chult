<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Separator } from '$lib/components/ui/separator';
	import { Slider } from '$lib/components/ui/slider';
	import * as Tooltip from '$lib/components/ui/tooltip';
	import { CircleDot, Eye, EyeOff, Minus, Plus, Trash2 } from '@lucide/svelte';

	interface Props {
		alwaysRevealMode: boolean;
		activeSelectMode: 'add' | 'remove';
		selectedCount: number;
		showBrushSize?: boolean;
		brushSize?: number;
		onToggleAlwaysReveal: () => void;
		onSetSelectMode: (mode: 'add' | 'remove') => void;
		onReveal: () => void;
		onHide: () => void;
		onClear: () => void;
		onBrushSizeChange?: (size: number) => void;
	}

	let {
		alwaysRevealMode,
		activeSelectMode,
		selectedCount,
		showBrushSize = false,
		brushSize = 3,
		onToggleAlwaysReveal,
		onSetSelectMode,
		onReveal,
		onHide,
		onClear,
		onBrushSizeChange
	}: Props = $props();
</script>

<div
	class="flex flex-col gap-2 items-center p-2 rounded-lg border bg-background/95 shadow-xs backdrop-blur-sm"
>
	<div class="flex gap-2 items-center">
		<!-- Always-Reveal Toggle -->
		<Tooltip.Root>
			<Tooltip.Trigger>
				<Button
					variant={alwaysRevealMode ? 'default' : 'ghost'}
					size="sm"
					onclick={onToggleAlwaysReveal}
				>
					<CircleDot class="w-4 h-4" />
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
					onclick={() => onSetSelectMode('add')}
				>
					<Plus class="w-4 h-4" />
				</Button>
			</Tooltip.Trigger>
			<Tooltip.Content>Add to selection</Tooltip.Content>
		</Tooltip.Root>

		<Tooltip.Root>
			<Tooltip.Trigger>
				<Button
					variant={activeSelectMode === 'remove' ? 'default' : 'ghost'}
					size="sm"
					onclick={() => onSetSelectMode('remove')}
				>
					<Minus class="w-4 h-4" />
				</Button>
			</Tooltip.Trigger>
			<Tooltip.Content>Remove from selection</Tooltip.Content>
		</Tooltip.Root>

		<Separator orientation="vertical" class="!h-6" />

		<!-- Action Buttons -->
		<Tooltip.Root>
			<Tooltip.Trigger>
				<Button disabled={selectedCount === 0} variant="ghost" size="sm" onclick={onReveal}>
					<Eye class="w-4 h-4" />
				</Button>
			</Tooltip.Trigger>
			<Tooltip.Content>Reveal Selected</Tooltip.Content>
		</Tooltip.Root>

		<Tooltip.Root>
			<Tooltip.Trigger>
				<Button disabled={selectedCount === 0} variant="ghost" size="sm" onclick={onHide}>
					<EyeOff class="w-4 h-4" />
				</Button>
			</Tooltip.Trigger>
			<Tooltip.Content>Hide Selected</Tooltip.Content>
		</Tooltip.Root>

		<Tooltip.Root>
			<Tooltip.Trigger>
				<Button disabled={selectedCount === 0} variant="ghost" size="sm" onclick={onClear}>
					<Trash2 class="w-4 h-4" />
				</Button>
			</Tooltip.Trigger>
			<Tooltip.Content>Clear Selection</Tooltip.Content>
		</Tooltip.Root>
	</div>

	<!-- Brush Size Slider -->
	{#if showBrushSize && onBrushSizeChange}
		<div class="flex gap-2 items-center">
			<div class="flex gap-2 items-center px-2">
				<span class="text-xs text-muted-foreground">Brush Size:</span>
				<div class="w-20">
					<Slider
						type="single"
						value={brushSize}
						onValueChange={(value) => onBrushSizeChange?.(value)}
						min={1}
						max={5}
						step={1}
						class="w-full"
					/>
				</div>
				<span class="w-6 font-mono text-xs text-center">{brushSize}</span>
			</div>
		</div>
	{/if}
</div>
