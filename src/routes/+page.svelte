<script lang="ts">
	let { data }: { data: PageData } = $props();

	import Map from '$lib/components/Map.svelte';

	import chultMap from '$lib/assets/map.jpg';
	import type { PageData } from './$types';

	function handleHexRevealed(event) {
		console.log('Hex revealed:', event.hex);
		// Handle individual hex reveals (save state, trigger events, etc.)
	}

	function handleAllHexesReset() {
		console.log('All hexes reset');
		// Handle reset event
	}

	function handleAllHexesRevealed() {
		console.log('All hexes revealed');
		// Handle reveal all event
	}
</script>

<main>
	<Map
		mapSrc={chultMap}
		showControls={false}
		initiallyRevealed={data.tiles}
		onHexRevealed={handleHexRevealed}
		onAllHexesReset={handleAllHexesReset}
		onAllHexesRevealed={handleAllHexesRevealed}
	/>
</main>
