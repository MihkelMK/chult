<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import {
		Dialog,
		DialogContent,
		DialogDescription,
		DialogFooter,
		DialogHeader,
		DialogTitle
	} from '$lib/components/ui/dialog';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { onMount } from 'svelte';

	interface Props {
		open: boolean;
		title: string;
		description: string;
		defaultTimeCost: number;
		onConfirm: (timeCost: number) => void;
		onCancel: () => void;
	}

	let {
		open = $bindable(),
		title,
		description,
		defaultTimeCost,
		onConfirm,
		onCancel
	}: Props = $props();

	let timeCost = $state(0);

	// Reset to default when dialog opens
	$effect(() => {
		if (open) {
			timeCost = defaultTimeCost;
		}
	});

	function formatTimeDays(days: number): string {
		if (days === 0) return '0 days';

		const months = Math.floor(days / 30);
		const weeks = Math.floor((days % 30) / 7);
		const remainingDays = Math.floor(days % 7);

		const parts: string[] = [];
		if (months > 0) parts.push(`${months} month${months !== 1 ? 's' : ''}`);
		if (weeks > 0) parts.push(`${weeks} week${weeks !== 1 ? 's' : ''}`);
		if (remainingDays > 0) parts.push(`${remainingDays} day${remainingDays !== 1 ? 's' : ''}`);

		return parts.join(' ') || '0 days';
	}

	function handleConfirm() {
		onConfirm(timeCost);
	}

	function handleCancel() {
		onCancel();
	}

	onMount(() => {
		timeCost = defaultTimeCost;
	});
</script>

<Dialog bind:open>
	<DialogContent class="z-60 sm:max-w-105">
		<DialogHeader>
			<DialogTitle>{title}</DialogTitle>
			<DialogDescription>{description}</DialogDescription>
		</DialogHeader>

		<div class="grid gap-4 py-4">
			<div class="grid grid-cols-4 items-center gap-4">
				<Label for="timeCost" class="text-right">Time Cost</Label>
				<Input
					id="timeCost"
					type="number"
					step="0.5"
					min="0"
					bind:value={timeCost}
					class="col-span-3"
				/>
			</div>

			<div class="text-sm text-muted-foreground">
				<strong>Time in game:</strong>
				{formatTimeDays(timeCost)}
			</div>
		</div>

		<DialogFooter>
			<Button variant="outline" onclick={handleCancel}>Cancel</Button>
			<Button onclick={handleConfirm}>Confirm</Button>
		</DialogFooter>
	</DialogContent>
</Dialog>
