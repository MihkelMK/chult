<script lang="ts">
	import { onMount } from 'svelte';

	const messages = [
		'Rolling for initiative',
		'Casting fireball',
		'Checking for traps',
		'Pestering the DM',
		'Waiting for party consensus',
		'Placing mimics in unfair locations',
		'Unfurling ancient scrolls',
		'Rerolling the encounter table',
		'Waiting for the bard to finish their song',
		'Generating suspiciously convenient taverns',
		'Generating random encounters',
		'Adding treasure (mostly copper)',
		'Please wait 2d20+4 seconds',
		'Consulting Monster Manual',
		'Unfolding battle mat'
	];

	function randomMessage(): string {
		return messages[Math.floor(Math.random() * messages.length)];
	}

	let messsageInterval: ReturnType<typeof setInterval>;
	let message = $state(randomMessage());

	onMount(() => {
		messsageInterval = setInterval(() => {
			message = randomMessage();
		}, 5000);

		return () => clearInterval(messsageInterval);
	});
</script>

<div
	class="flex absolute top-0 left-0 flex-col gap-4 justify-center items-center p-4 w-screen h-screen bg-gray-200 rounded-lg"
>
	<h2 class="pb-2 text-3xl font-semibold tracking-tight first:mt-0 scroll-m-20">
		{message}
	</h2>
	<h3 class="text-[0]">
		<span class="text-3xl delay-75 animate-caret-blink">.</span>
		<span class="text-3xl animate-caret-blink delay-[275ms]">.</span>
		<span class="text-3xl animate-caret-blink delay-[425ms]">.</span>
	</h3>
</div>
