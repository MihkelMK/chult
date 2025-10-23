<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import * as Tooltip from '$lib/components/ui/tooltip';
	import { Hand, Minus, MousePointer, Paintbrush, Plus, Square } from '@lucide/svelte';

	type ToolMode = 'interact' | 'pan' | 'select' | 'paint';
	type SelectMode = 'add' | 'remove';

	interface Props {
		activeTool: ToolMode;
		activeSelectMode: SelectMode;
		brushSize: number;
		showDMTools?: boolean;
		onSelectTool: (tool: ToolMode) => void;
	}

	let {
		activeTool,
		activeSelectMode,
		brushSize,
		showDMTools = false,
		onSelectTool
	}: Props = $props();
</script>

<div class="flex gap-1 p-1 rounded-lg border bg-background/95 shadow-xs backdrop-blur-sm">
	<Tooltip.Root>
		<Tooltip.Trigger>
			{#snippet child({ props })}
				<Button
					{...props}
					variant={activeTool === 'interact' ? 'default' : 'ghost'}
					size="sm"
					onclick={() => onSelectTool('interact')}
				>
					<MousePointer class="w-4 h-4" />
				</Button>
			{/snippet}
		</Tooltip.Trigger>
		<Tooltip.Content side="top">Default Cursor - Interact with hexes</Tooltip.Content>
	</Tooltip.Root>

	<Tooltip.Root>
		<Tooltip.Trigger>
			{#snippet child({ props })}
				<Button
					{...props}
					variant={activeTool === 'pan' ? 'default' : 'ghost'}
					size="sm"
					onclick={() => onSelectTool('pan')}
				>
					<Hand class="w-4 h-4" />
				</Button>
			{/snippet}
		</Tooltip.Trigger>
		<Tooltip.Content side="top">Pan Mode - Drag or scroll to pan</Tooltip.Content>
	</Tooltip.Root>

	{#if showDMTools}
		<Tooltip.Root>
			<Tooltip.Trigger>
				{#snippet child({ props })}
					<Button
						{...props}
						variant={activeTool === 'select' ? 'default' : 'ghost'}
						size="sm"
						onclick={() => onSelectTool('select')}
						class="relative"
					>
						<Square class="w-4 h-4" />
						{#if activeTool === 'select'}
							<span
								class="absolute -top-1 -right-1 flex h-3 w-3 items-center justify-center rounded-full text-xs {activeSelectMode ===
								'add'
									? 'bg-green-500'
									: 'bg-red-500'}"
							>
								{#if activeSelectMode === 'add'}
									<Plus class="w-2 h-2 text-white" />
								{:else}
									<Minus class="w-2 h-2 text-white" />
								{/if}
							</span>
						{/if}
					</Button>
				{/snippet}
			</Tooltip.Trigger>
			<Tooltip.Content side="top">Multi-select - Select hexes for bulk operations</Tooltip.Content>
		</Tooltip.Root>

		<Tooltip.Root>
			<Tooltip.Trigger>
				{#snippet child({ props })}
					<Button
						{...props}
						variant={activeTool === 'paint' ? 'default' : 'ghost'}
						size="sm"
						onclick={() => onSelectTool('paint')}
						class="relative"
					>
						<Paintbrush class="w-4 h-4" />
						{#if activeTool === 'paint'}
							<span
								class="absolute -top-1 -right-1 flex h-3 w-3 items-center justify-center rounded-full text-xs {activeSelectMode ===
								'add'
									? 'bg-green-500'
									: 'bg-red-500'}"
							>
								{#if activeSelectMode === 'add'}
									<Plus class="w-2 h-2 text-white" />
								{:else}
									<Minus class="w-2 h-2 text-white" />
								{/if}
							</span>
						{/if}
					</Button>
				{/snippet}
			</Tooltip.Trigger>
			<Tooltip.Content side="top">
				Paint Mode - {activeSelectMode === 'add' ? 'Add' : 'Remove'} tiles (size {brushSize})
			</Tooltip.Content>
		</Tooltip.Root>
	{/if}
</div>
