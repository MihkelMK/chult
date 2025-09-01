<script lang="ts">
	import { enhance } from '$app/forms';
	import type { SessionData } from '$lib/server/session';

	interface Props {
		session: SessionData;
	}
	let { session }: Props = $props();
</script>

{#if session.viewAs === 'player'}
	<div class="bg-yellow-100 p-4 text-center text-sm text-yellow-800">
		You are currently viewing as a player.
		<form action="/dm/{session.campaignSlug}?/toggleView" method="POST" use:enhance class="inline">
			<button type="submit" class="font-semibold underline hover:text-yellow-900">
				Return to DM View
			</button>
		</form>
	</div>
{/if}
