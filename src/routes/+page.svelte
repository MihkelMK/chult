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
	import { Eye, EyeOff, Map } from '@lucide/svelte';
	import { toast } from 'svelte-sonner';

	let campaignSlug = $state('');
	let accessToken = $state('');
	let loading = $state(false);
	let loginFailed = $state(false);
	let showToken = $state(false);

	// Form is valid when both fields have values
	let isValid = $derived(campaignSlug.trim() && accessToken.trim());
</script>

<svelte:head>
	<title>Campaign Access - Chult</title>
</svelte:head>

<div class="flex min-h-screen items-center justify-center bg-muted/20">
	<div class="container mx-auto max-w-md p-6">
		<Card>
			<CardHeader class="text-center">
				<div class="mb-4 flex justify-center">
					<div class="rounded-full bg-primary/10 p-3">
						<Map class="h-8 w-8 text-primary" />
					</div>
				</div>
				<CardTitle class="text-2xl">Campaign Access</CardTitle>
				<CardDescription>Enter your campaign code and access token</CardDescription>
			</CardHeader>
			<CardContent>
				<form
					method="POST"
					action="?/access"
					class="space-y-4"
					use:enhance={() => {
						loading = true;
						loginFailed = false;
						return async ({ result }) => {
							loading = false;
							if (result.type === 'redirect') {
								// eslint-disable-next-line svelte/no-navigation-without-resolve
								goto(result.location);
							} else if (result.type === 'failure') {
								loginFailed = true;
								interface FailureData {
									message?: string;
								}
								const failureData = result.data as FailureData | undefined;
								const errorMessage = failureData?.message || 'Access denied';
								toast.error(errorMessage);
							}
						};
					}}
				>
					<div class="space-y-2">
						<Label for="campaignSlug">Campaign Code</Label>
						<Input
							id="campaignSlug"
							name="campaignSlug"
							type="text"
							required
							bind:value={campaignSlug}
							placeholder="Enter campaign code"
							disabled={loading}
							aria-invalid={loginFailed}
							autocomplete="username webauthn"
							oninput={() => (loginFailed = false)}
						/>
					</div>

					<div class="space-y-2">
						<Label for="accessToken">Access Token</Label>
						<div class="flex gap-2">
							<Input
								id="accessToken"
								name="accessToken"
								type={showToken ? 'text' : 'password'}
								required
								bind:value={accessToken}
								placeholder="Enter access token"
								disabled={loading}
								class="flex-1"
								aria-invalid={loginFailed}
								autocomplete="current-password webauthn"
								oninput={() => (loginFailed = false)}
							/>
							<Button
								type="button"
								variant="outline"
								size="icon"
								onclick={() => (showToken = !showToken)}
								disabled={loading}
							>
								{#if showToken}
									<EyeOff class="h-4 w-4" />
								{:else}
									<Eye class="h-4 w-4" />
								{/if}
							</Button>
						</div>
					</div>

					<Button type="submit" disabled={loading || !isValid} class="w-full">
						{loading ? 'Accessing...' : 'Access Campaign'}
					</Button>
				</form>
			</CardContent>
		</Card>
	</div>
</div>
