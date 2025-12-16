<script lang="ts">
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import * as Tooltip from '$lib/components/ui/tooltip';
	import { Play, Square } from '@lucide/svelte';

	interface Props {
		hasActiveSession: boolean;
		sessionNumber?: number;
		onStartSession: () => void;
		onEndSession: () => void;
	}

	let { hasActiveSession, sessionNumber, onStartSession, onEndSession }: Props = $props();
</script>

<div
	class="flex items-center gap-2 rounded-lg border bg-background/95 p-2 shadow-xs backdrop-blur-sm"
>
	{#if hasActiveSession}
		<Badge variant="default" class="text-xs">
			Session {sessionNumber} Active
		</Badge>
		<Tooltip.Root>
			<Tooltip.Trigger>
				<Button variant="destructive" size="sm" onclick={onEndSession}>
					<Square class="h-4 w-4" />
				</Button>
			</Tooltip.Trigger>
			<Tooltip.Content>End Session</Tooltip.Content>
		</Tooltip.Root>
	{:else}
		<Tooltip.Root>
			<Tooltip.Trigger>
				<Button variant="default" size="sm" onclick={onStartSession}>
					<Play class="h-4 w-4" />
				</Button>
			</Tooltip.Trigger>
			<Tooltip.Content>Start Session</Tooltip.Content>
		</Tooltip.Root>
	{/if}
</div>
