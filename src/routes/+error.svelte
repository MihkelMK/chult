<script lang="ts">
	import { page } from '$app/state';
	import * as Empty from '$lib/components/ui/empty';
	import { Button } from '$lib/components/ui/button';
	import { ArrowLeft, House, MapPinOff } from '@lucide/svelte';
	import type { Component } from 'svelte';

	const errorMessages: Record<number, { title: string; description: string; icon: Component }> = {
		404: {
			title: 'Map Not Found',
			description:
				"This location doesn't exist in our realm. Perhaps the cartographer made an error?",
			icon: MapPinOff
		},
		403: {
			title: 'Access Denied',
			description: "You don't have permission to access this area. Check your access token.",
			icon: MapPinOff
		},
		500: {
			title: 'Something Went Wrong',
			description: 'An unexpected error occurred. Our dungeon masters have been notified.',
			icon: MapPinOff
		}
	};

	let status = $derived(page.status);
	let errorInfo = $derived(
		errorMessages[status] || {
			title: 'An Error Occurred',
			description: page.error?.message || 'Something unexpected happened.',
			icon: MapPinOff
		}
	);
	let Icon = $derived(errorInfo.icon);
</script>

<svelte:head>
	<title>{status} - {errorInfo.title}</title>
</svelte:head>

<div class="flex justify-center items-center p-4 min-h-screen bg-background">
	<Empty.Root class="max-w-md border">
		<Empty.Header>
			<Empty.Media>
				<Icon class="w-12 h-12 text-muted-foreground" />
			</Empty.Media>
			<Empty.Title>{errorInfo.title}</Empty.Title>
			<Empty.Description>{errorInfo.description}</Empty.Description>
		</Empty.Header>
		<Empty.Content>
			<div class="flex flex-col gap-2 sm:flex-row">
				<Button href="/" variant="default">
					<House class="mr-2 w-4 h-4" />
					Go Home
				</Button>
				<Button onclick={() => history.back()} variant="outline">
					<ArrowLeft class="mr-2 w-4 h-4" />
					Go Back
				</Button>
			</div>
		</Empty.Content>
	</Empty.Root>
</div>
