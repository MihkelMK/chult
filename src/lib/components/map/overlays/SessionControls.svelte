<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Badge } from '$lib/components/ui/badge';
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
	class="flex gap-2 items-center p-2 rounded-lg border bg-background/95 shadow-xs backdrop-blur-sm"
>
	{#if hasActiveSession}
		<Badge variant="default" class="text-xs">
			Session {sessionNumber} Active
		</Badge>
		<Tooltip.Root>
			<Tooltip.Trigger>
				<Button variant="destructive" size="sm" onclick={onEndSession}>
					<Square class="w-4 h-4" />
				</Button>
			</Tooltip.Trigger>
			<Tooltip.Content>End Session</Tooltip.Content>
		</Tooltip.Root>
	{:else}
		<Tooltip.Root>
			<Tooltip.Trigger>
				<Button variant="default" size="sm" onclick={onStartSession}>
					<Play class="w-4 h-4" />
				</Button>
			</Tooltip.Trigger>
			<Tooltip.Content>Start Session</Tooltip.Content>
		</Tooltip.Root>
	{/if}
</div>
