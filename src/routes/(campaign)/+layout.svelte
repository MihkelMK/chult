<script lang="ts">
	import { DIContainer, setDIContainer } from '$lib/contexts/diContext';
	import { LocalStateDM } from '$lib/stores/localStateDM.svelte';
	import { LocalStatePlayer } from '$lib/stores/localStatePlayer.svelte';

	const container = new DIContainer();
	container.register(Symbol.for('LocalStateDM'), LocalStateDM);
	container.register(Symbol.for('LocalStatePlayer'), LocalStatePlayer);
	setDIContainer(container);

	let { children } = $props();
</script>

{@render children?.()}
