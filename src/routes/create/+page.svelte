<script lang="ts">
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import { Button } from '$lib/components/ui/button';
	import {
		Card,
		CardContent,
		CardDescription,
		CardHeader,
		CardTitle
	} from '$lib/components/ui/card';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Eye, EyeOff, Plus } from '@lucide/svelte';
	import { toast } from 'svelte-sonner';

	let campaignName = $state('');
	let accessToken = $state('');
	let loading = $state(false);
	let createFailed = $state(false);
	let showToken = $state(false);

	// Form is valid when both fields have values
	let isValid = $derived(campaignName.trim() && accessToken.trim());
</script>

<svelte:head>
	<title>Create Campaign - Chult</title>
</svelte:head>

<div class="flex justify-center items-center min-h-screen bg-muted/20">
	<div class="container p-6 mx-auto max-w-md">
		<Card>
			<CardHeader class="text-center">
				<div class="flex justify-center mb-4">
					<div class="p-3 rounded-full bg-primary/10">
						<Plus class="w-8 h-8 text-primary" />
					</div>
				</div>
				<CardTitle class="text-2xl">Create Campaign</CardTitle>
				<CardDescription>Set up a new D&D campaign map</CardDescription>
			</CardHeader>
			<CardContent>
				<form
					method="POST"
					action="?/create"
					class="space-y-4"
					use:enhance={() => {
						loading = true;
						createFailed = false;
						return async ({ result }) => {
							loading = false;
							if (result.type === 'redirect') {
								goto(result.location);
							} else if (result.type === 'failure') {
								createFailed = true;
								interface FailureData {
									error?: string;
								}
								const failureData = result.data as FailureData | undefined;
								const errorMessage = failureData?.error || 'Failed to create campaign';
								toast.error(errorMessage);
							}
						};
					}}
				>
					<div class="space-y-2">
						<Label for="campaignName">Campaign Name</Label>
						<Input
							id="campaignName"
							name="campaignName"
							type="text"
							required
							bind:value={campaignName}
							placeholder="Enter campaign name"
							disabled={loading}
							aria-invalid={createFailed}
						/>
					</div>

					<div class="space-y-2">
						<Label for="accessToken">Super Secret DM Code</Label>
						<div class="flex gap-2">
							<Input
								id="accessToken"
								name="accessToken"
								type={showToken ? 'text' : 'password'}
								required
								bind:value={accessToken}
								placeholder="Enter DM Code"
								disabled={loading}
								class="flex-1"
								aria-invalid={createFailed}
							/>
							<Button
								type="button"
								variant="outline"
								size="icon"
								onclick={() => (showToken = !showToken)}
								disabled={loading}
							>
								{#if showToken}
									<EyeOff class="w-4 h-4" />
								{:else}
									<Eye class="w-4 h-4" />
								{/if}
							</Button>
						</div>
					</div>

					<Button type="submit" disabled={loading || !isValid} class="w-full">
						{loading ? 'Creating...' : 'Create Campaign'}
					</Button>
				</form>
			</CardContent>
		</Card>
	</div>
</div>
