<script lang="ts">
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Empty from '$lib/components/ui/empty/index.js';
	import type { UserRole } from '$lib/types';
	import { Map } from '@lucide/svelte';

	interface Props {
		userRole: UserRole;
		slug: string;
	}

	let { userRole, slug }: Props = $props();
</script>

<div class="flex h-full items-center justify-center">
	<Empty.Root class="border border-dashed">
		<Empty.Header>
			<Empty.Media variant="icon">
				<Map />
			</Empty.Media>
			<Empty.Title>Map Not Available</Empty.Title>
			<Empty.Description>
				{#if userRole === 'dm'}
					Upload a map in the settings to get started.
				{:else}
					The campaign map is being prepared by your DM.
				{/if}
			</Empty.Description>
		</Empty.Header>
		<Empty.Content>
			<Button variant="outline" size="sm" href="/{slug}/settings" class="cursor-pointer">
				Go to settings
			</Button>
		</Empty.Content>
	</Empty.Root>pnpm dlx shadcn-svelte@latest add kbd
</div>
