<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import * as Tooltip from '$lib/components/ui/tooltip';
	import type { SelectMode, UITool } from '$lib/types';
	import { Hand, Minus, MousePointer, Navigation, Paintbrush, Plus, Square } from '@lucide/svelte';

	interface Props {
		activeTool: UITool;
		activeSelectMode: SelectMode;
		brushSize: number;
		showDMTools?: boolean;
		showExploreTool?: boolean;
		canExplore?: boolean;
		onSelectTool: (tool: UITool) => void;
	}

	let {
		activeTool,
		activeSelectMode,
		brushSize,
		showDMTools = false,
		showExploreTool = false,
		canExplore = false,
		onSelectTool
	}: Props = $props();
</script>

<div class="absolute bottom-4 left-1/2 z-20 -translate-x-1/2">
	<div class="flex gap-1 p-1 rounded-lg border bg-background/95 shadow-xs backdrop-blur-sm">
		<Tooltip.Root>
			<Tooltip.Trigger>
				{#snippet child({ props })}
					<Button
						{...props}
						variant={activeTool === 'interact' ? 'default' : 'ghost'}
						size="sm"
						class="cursor-pointer"
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
						class="cursor-pointer"
						onclick={() => onSelectTool('pan')}
					>
						<Hand class="w-4 h-4" />
					</Button>
				{/snippet}
			</Tooltip.Trigger>
			<Tooltip.Content side="top">Pan Mode - Drag or scroll to pan</Tooltip.Content>
		</Tooltip.Root>

		{#if showExploreTool}
			<Tooltip.Root>
				<Tooltip.Trigger>
					{#snippet child({ props })}
						<Button
							{...props}
							variant={activeTool === 'explore' ? 'default' : 'ghost'}
							size="sm"
							class="cursor-pointer"
							onclick={() => onSelectTool('explore')}
							disabled={!canExplore}
						>
							<Navigation class="w-4 h-4" />
						</Button>
					{/snippet}
				</Tooltip.Trigger>
				<Tooltip.Content side="top">
					{canExplore ? 'Explore Mode - Move party token' : 'No active session'}
				</Tooltip.Content>
			</Tooltip.Root>
		{/if}

		{#if showDMTools}
			<Tooltip.Root>
				<Tooltip.Trigger>
					{#snippet child({ props })}
						<Button
							{...props}
							variant={activeTool === 'select' ? 'default' : 'ghost'}
							size="sm"
							onclick={() => onSelectTool('select')}
							class="cursor-pointer relativ"
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
				<Tooltip.Content side="top">Multi-select - Select hexes for bulk operations</Tooltip.Content
				>
			</Tooltip.Root>

			<Tooltip.Root>
				<Tooltip.Trigger>
					{#snippet child({ props })}
						<Button
							{...props}
							variant={activeTool === 'paint' ? 'default' : 'ghost'}
							size="sm"
							onclick={() => onSelectTool('paint')}
							class="relative cursor-pointer"
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
</div>
