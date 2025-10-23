<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import * as Tooltip from '$lib/components/ui/tooltip';
	import { Minus, Plus } from '@lucide/svelte';

	interface Props {
		zoom: number;
		onZoomIn: () => void;
		onZoomOut: () => void;
		onResetZoom: () => void;
	}

	let { zoom, onZoomIn, onZoomOut, onResetZoom }: Props = $props();
</script>

<div class="flex flex-col gap-1 p-1 rounded-lg border bg-background/95 shadow-xs backdrop-blur-sm">
	<Tooltip.Root>
		<Tooltip.Trigger>
			<Button variant="ghost" size="sm" onclick={onZoomIn}>
				<Plus class="w-4 h-4" />
			</Button>
		</Tooltip.Trigger>
		<Tooltip.Content side="right">Zoom In</Tooltip.Content>
	</Tooltip.Root>

	<Tooltip.Root>
		<Tooltip.Trigger>
			<Button variant="ghost" size="sm" onclick={onResetZoom} class={zoom === 1 ? 'bg-accent' : ''}>
				<span class="font-mono text-xs">{zoom * 100}%</span>
			</Button>
		</Tooltip.Trigger>
		<Tooltip.Content side="right">Reset Zoom • Scroll to pan</Tooltip.Content>
	</Tooltip.Root>

	<Tooltip.Root>
		<Tooltip.Trigger>
			<Button variant="ghost" size="sm" onclick={onZoomOut}>
				<Minus class="w-4 h-4" />
			</Button>
		</Tooltip.Trigger>
		<Tooltip.Content side="right">Zoom Out</Tooltip.Content>
	</Tooltip.Root>
</div>
