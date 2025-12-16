<script lang="ts">
	import { Badge } from '$lib/components/ui/badge';
	import Button from '$lib/components/ui/button/button.svelte';
	import * as Dialog from '$lib/components/ui/dialog';
	import * as Empty from '$lib/components/ui/empty';
	import ScrollArea from '$lib/components/ui/scroll-area/scroll-area.svelte';
	import * as Table from '$lib/components/ui/table-scrollable';
	import * as ToggleGroup from '$lib/components/ui/toggle-group';
	import type { TimeAuditLogResponse } from '$lib/types/database';
	import { Clock } from '@lucide/svelte';

	interface Props {
		timeAuditLog: TimeAuditLogResponse[];
		globalGameTime: number;
	}

	let { timeAuditLog, globalGameTime }: Props = $props();

	let open = $state(false);
	let filterType = $state<string>('all');

	// Filter options
	const typeOptions = [
		{ value: 'all', label: 'All' },
		{ value: 'movement', label: 'Movement' },
		{ value: 'undo', label: 'Undo' },
		{ value: 'dm_teleport', label: 'Teleport' },
		{ value: 'dm_path', label: 'Path' },
		{ value: 'dm_adjust', label: 'Adjustment' }
	];

	let filteredLog = $derived.by(() => {
		if (filterType === 'all') return timeAuditLog;
		return timeAuditLog.filter((entry) => entry.type === filterType);
	});

	function formatTime(days: number): string {
		const months = Math.floor(days / 30);
		const remainingAfterMonths = days % 30;
		const weeks = Math.floor(remainingAfterMonths / 7);
		const remainingDays = Math.floor(remainingAfterMonths % 7);

		const parts: string[] = [];
		if (months > 0) parts.push(`${months}mo`);
		if (weeks > 0) parts.push(`${weeks}w`);
		if (remainingDays > 0 || parts.length === 0) parts.push(`${remainingDays}d`);

		return parts.join(' ');
	}

	function formatDelta(amount: number): string {
		const sign = amount > 0 ? '+' : '';
		return `${sign}${formatTime(Math.abs(amount))}`;
	}

	function formatTimestamp(timestamp: Date): string {
		const date = new Date(timestamp);
		const isoDateTime = date.toISOString();
		const [isoDate, isoTime] = isoDateTime.split('T');
		const isoTimeHHMMSS = isoTime.slice(0, 8);

		return `${isoDate} ${isoTimeHHMMSS}`;
	}

	function getTypeBadgeVariant(type: string): 'default' | 'secondary' | 'outline' | 'destructive' {
		switch (type) {
			case 'movement':
				return 'default';
			case 'dm_teleport':
				return 'secondary';
			case 'dm_path':
				return 'secondary';
			case 'dm_adjust':
				return 'outline';
			case 'undo':
				return 'destructive';
			default:
				return 'outline';
		}
	}

	function getTypeLabel(type: string): string {
		switch (type) {
			case 'movement':
				return 'Move';
			case 'dm_teleport':
				return 'Teleport';
			case 'dm_path':
				return 'Path';
			case 'dm_adjust':
				return 'Adjust';
			case 'undo':
				return 'Undo';
			default:
				return type;
		}
	}

	// Calculate running total in reverse (newest first)
	let runningTotals = $derived.by(() => {
		let total = globalGameTime;
		return timeAuditLog.map((entry) => {
			const entryTotal = total;
			total -= entry.amount;
			return entryTotal;
		});
	});
</script>

<Dialog.Root {open}>
	<Dialog.Trigger>
		<Button variant="outline" size="sm" class="cursor-pointer">
			Audit logs
			<Badge variant="secondary" class="text-xs">{timeAuditLog.length}</Badge>
		</Button>
	</Dialog.Trigger>

	<Dialog.Content class="flex max-h-[80vh] flex-col gap-2 sm:max-w-[800px]">
		<Dialog.Header class="mb-4">
			<Dialog.Title>Audit Changes to Game Time</Dialog.Title>
			<Dialog.Description>
				View logs of when, why and by how much game time has changed.
			</Dialog.Description>
		</Dialog.Header>

		{#if timeAuditLog.length === 0}
			<Empty.Root>
				<Empty.Content>
					<Empty.Media>
						<Clock class="h-8 w-8 text-muted-foreground" />
					</Empty.Media>
					<Empty.Header>
						<Empty.Title>No time changes</Empty.Title>
						<Empty.Description>
							{filterType === 'all'
								? 'No time changes have been recorded yet'
								: `No ${filterType} entries found`}
						</Empty.Description>
					</Empty.Header>
				</Empty.Content>
			</Empty.Root>
		{:else}
			<!-- Filter -->
			<div class="flex w-full items-center gap-2">
				<p class="text-sm font-medium">Filter type:</p>
				<ToggleGroup.Root
					type="single"
					value={filterType}
					onValueChange={(value) => {
						if (value) filterType = value;
					}}
					class="flex flex-wrap justify-center gap-1"
				>
					{#each typeOptions as option (option.value)}
						<ToggleGroup.Item size="sm" value={option.value} class="h-7 flex-auto grow-0 text-xs">
							{option.label}
						</ToggleGroup.Item>
					{/each}
				</ToggleGroup.Root>
			</div>
			<!-- Log entries -->
			<Table.Root>
				<ScrollArea orientation="horizontal">
					<Table.Header>
						<Table.Row>
							<Table.Head class="w-24 text-center">Type</Table.Head>
							<Table.Head class="w-28">Time Delta</Table.Head>
							<Table.Head class="w-28">Game Time</Table.Head>
							<Table.Head class="w-40">Timestamp</Table.Head>
							<Table.Head class="">Notes</Table.Head>
						</Table.Row>
					</Table.Header>
					<Table.Body height="h-[50vh]">
						{#each filteredLog as entry (entry.id)}
							{@const runningTotal = runningTotals[timeAuditLog.indexOf(entry)]}
							<Table.Row>
								<Table.Cell class="w-24 text-center">
									<Badge variant={getTypeBadgeVariant(entry.type)} class="text-xs">
										{getTypeLabel(entry.type)}
									</Badge>
								</Table.Cell>
								<Table.Cell class="w-28">
									{formatDelta(entry.amount)}
								</Table.Cell>
								<Table.Cell class="w-28">
									{formatTime(runningTotal)}
								</Table.Cell>
								<Table.Cell class="w-40">
									{formatTimestamp(entry.timestamp)}
								</Table.Cell>
								<Table.Cell class="">
									{#if entry.notes}
										<p class="text-sm text-muted-foreground italic">{entry.notes}</p>
									{/if}
								</Table.Cell>
							</Table.Row>
						{/each}
					</Table.Body>
				</ScrollArea>
			</Table.Root>
		{/if}
	</Dialog.Content>
</Dialog.Root>
