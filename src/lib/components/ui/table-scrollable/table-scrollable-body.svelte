<script lang="ts">
	import { cn, type WithElementRef } from '$lib/utils.js';
	import { ScrollArea as ScrollAreaPrimitive } from 'bits-ui';
	import type { HTMLTableAttributes } from 'svelte/elements';

	let {
		ref = $bindable(null),
		viewportRef = $bindable(null),
		class: className,
		height = 'h-[400px]',
		children,
		...restProps
	}: WithElementRef<HTMLTableAttributes> & {
		height?: string;
		viewportRef?: HTMLElement | null;
	} = $props();
</script>

<ScrollAreaPrimitive.Root data-slot="table-scrollable-body-root" class="relative">
	<ScrollAreaPrimitive.Viewport
		bind:ref={viewportRef}
		data-slot="table-scrollable-body-viewport"
		class={cn('size-full rounded-[inherit] ring-ring/10 dark:ring-ring/20', height)}
	>
		<table bind:this={ref} class={cn('w-full caption-bottom text-sm', className)} {...restProps}>
			<tbody data-slot="table-body" class="[&_tr:last-child]:border-0">
				{@render children?.()}
			</tbody>
		</table>
	</ScrollAreaPrimitive.Viewport>
	<ScrollAreaPrimitive.Scrollbar
		orientation="vertical"
		class="flex p-px w-2.5 h-full border-l transition-colors select-none touch-none border-l-transparent"
	>
		<ScrollAreaPrimitive.Thumb
			class="relative flex-1 rounded-full transition-colors bg-border hover:bg-border/80"
		/>
	</ScrollAreaPrimitive.Scrollbar>
	<ScrollAreaPrimitive.Corner />
</ScrollAreaPrimitive.Root>
