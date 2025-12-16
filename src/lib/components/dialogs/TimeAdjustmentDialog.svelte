<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import * as Dialog from '$lib/components/ui/dialog';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import * as Tooltip from '$lib/components/ui/tooltip';
	import { CircleAlert } from '@lucide/svelte';

	interface Props {
		onAdjustTime: (delta: number, notes: string) => void;
		disabled?: boolean;
	}

	let { onAdjustTime, disabled = false }: Props = $props();

	let open = $state(false);
	let timeDelta = $state<number>(0);
	let notes = $state<string>('');
	let showConfirm = $state(false);

	function handleSubmit() {
		if (timeDelta === 0) return;

		// Show confirmation for large adjustments (>7 days)
		if (Math.abs(timeDelta) > 7 && !showConfirm) {
			showConfirm = true;
			return;
		}

		onAdjustTime(timeDelta, notes);

		// Reset form and close dialog
		timeDelta = 0;
		notes = '';
		showConfirm = false;
		open = false;
	}

	function cancelConfirm() {
		showConfirm = false;
	}

	function handleOpenChange(isOpen: boolean) {
		open = isOpen;
		if (!isOpen) {
			// Reset form when dialog closes
			timeDelta = 0;
			notes = '';
			showConfirm = false;
		}
	}

	let formattedDelta = $derived.by(() => {
		if (timeDelta === 0) return '0d';

		const absDelta = Math.abs(timeDelta);
		const sign = timeDelta > 0 ? '+' : '-';
		const months = Math.floor(absDelta / 30);
		const remainingAfterMonths = absDelta % 30;
		const weeks = Math.floor(remainingAfterMonths / 7);
		const days = Math.floor(remainingAfterMonths % 7);

		const parts: string[] = [];
		if (months > 0) parts.push(`${months}mo`);
		if (weeks > 0) parts.push(`${weeks}w`);
		if (days > 0 || parts.length === 0) parts.push(`${days}d`);

		return `${sign}${parts.join(' ')}`;
	});
</script>

<Dialog.Root {open} onOpenChange={handleOpenChange}>
	<Dialog.Trigger>
		<Button variant="outline" size="sm" class="cursor-pointer" {disabled}>Adjust Time</Button>
	</Dialog.Trigger>

	<Dialog.Content class="sm:max-w-[425px]">
		<Dialog.Header>
			<Dialog.Title>Adjust Global Game Time</Dialog.Title>
			<Dialog.Description>
				Manually adjust the global game time. This is useful for downtime, travel, or other events
				not tracked by movement.
			</Dialog.Description>
		</Dialog.Header>

		<div class="space-y-4 py-4">
			<div class="space-y-2">
				<Label for="time-delta" class="text-sm font-medium">Time Adjustment (days)</Label>
				<div class="flex items-center gap-2">
					<Input
						id="time-delta"
						type="number"
						step="0.5"
						bind:value={timeDelta}
						{disabled}
						placeholder="0"
						class="font-mono"
					/>
					<Tooltip.Root>
						<Tooltip.Trigger>
							<div class="min-w-[80px] rounded border px-3 py-1 text-center font-mono text-sm">
								{formattedDelta}
							</div>
						</Tooltip.Trigger>
						<Tooltip.Content>
							<p>Formatted time display</p>
						</Tooltip.Content>
					</Tooltip.Root>
				</div>
				<p class="text-xs text-muted-foreground">
					Enter positive (forward) or negative (backward) time in days
				</p>
			</div>

			<div class="space-y-2">
				<Label for="time-notes" class="text-sm font-medium">Notes (optional)</Label>
				<Input
					id="time-notes"
					type="text"
					bind:value={notes}
					{disabled}
					placeholder="e.g., Long rest, travel montage..."
				/>
			</div>

			{#if showConfirm}
				<div
					class="flex items-start gap-2 rounded-lg border bg-yellow-50 p-3 dark:bg-yellow-950/20"
				>
					<CircleAlert class="mt-0.5 h-4 w-4 text-yellow-600 dark:text-yellow-500" />
					<div class="flex-1">
						<p class="text-sm font-medium text-yellow-800 dark:text-yellow-200">
							Large time adjustment
						</p>
						<p class="mt-1 text-xs text-yellow-700 dark:text-yellow-300">
							You're about to adjust time by {formattedDelta}. This will affect the global game time
							and cannot be easily undone.
						</p>
						<div class="mt-3 flex gap-2">
							<Button size="sm" variant="default" onclick={handleSubmit}>Confirm</Button>
							<Button size="sm" variant="outline" onclick={cancelConfirm}>Cancel</Button>
						</div>
					</div>
				</div>
			{/if}
		</div>

		<Dialog.Footer>
			{#if !showConfirm}
				<Button onclick={handleSubmit} disabled={disabled || timeDelta === 0} class="w-full">
					Adjust Time
				</Button>
			{/if}
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
