<script lang="ts">
	import Label from '$lib/components/ui/label/label.svelte';
	import Switch from '$lib/components/ui/switch/switch.svelte';
	import type { UserRole } from '$lib/types';

	interface Props {
		effectiveRole: UserRole;
		onCheckedChange: (checked: boolean) => void;
	}

	let { effectiveRole, onCheckedChange }: Props = $props();
</script>

<div class="flex items-center space-x-2">
	<Label for="role-switch">Player</Label>
	<Switch id="role-switch" {onCheckedChange} checked={effectiveRole === 'dm'} />
	<Label for="role-switch">DM</Label>
</div>
