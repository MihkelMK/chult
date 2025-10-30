<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import * as Dialog from '$lib/components/ui/dialog';
	import type { DialogConfig } from '$lib/types';

	interface Props extends DialogConfig {
		open: boolean;
	}

	let { open = $bindable(), title, description, actions }: Props = $props();

	function handleAction(action: () => void) {
		action();
		open = false;
	}
</script>

<Dialog.Root bind:open>
	<Dialog.Content class="z-[60]">
		<Dialog.Header>
			<Dialog.Title>{title}</Dialog.Title>
			<Dialog.Description>{description}</Dialog.Description>
		</Dialog.Header>
		<Dialog.Footer>
			{#each actions as action (action.label)}
				<Button
					class="cursor-pointer"
					variant={action.variant ?? 'default'}
					onclick={() => handleAction(action.action)}
				>
					{action.label}
				</Button>
			{/each}
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
