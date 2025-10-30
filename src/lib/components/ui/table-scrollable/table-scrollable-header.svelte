<script lang="ts">
	import { cn, type WithElementRef } from '$lib/utils.js';
	import type { HTMLTableAttributes } from 'svelte/elements';

	let {
		ref = $bindable(null),
		class: className,
		children,
		...restProps
	}: WithElementRef<HTMLTableAttributes> = $props();
</script>

<div data-slot="table-scrollable-header" class="border-b bg-background">
	<table bind:this={ref} class={cn('w-full caption-bottom text-sm', className)} {...restProps}>
		<thead data-slot="table-header" class="[&_tr]:border-b">
			{@render children?.()}
		</thead>
	</table>
</div>
