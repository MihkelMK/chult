<script lang="ts">
	interface Props {
		globalGameTime: number;
	}

	let { globalGameTime }: Props = $props();

	// Format time as "X months Y weeks Z days"
	let timeDisplay = $derived.by(() => {
		const days = globalGameTime;
		const months = Math.floor(days / 30);
		const remainingAfterMonths = days % 30;
		const weeks = Math.floor(remainingAfterMonths / 7);
		const remainingDays = Math.floor(remainingAfterMonths % 7);

		const parts: string[] = [];
		if (months > 0) parts.push(`${months}mo`);
		if (weeks > 0) parts.push(`${weeks}w`);
		if (remainingDays > 0 || parts.length === 0) parts.push(`${remainingDays}d`);

		return parts.join(' ');
	});
</script>

<span class="font-medium">{timeDisplay}</span>
