<script lang="ts">
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';

	let campaignSlug = $state('');
	let accessToken = $state('');
	let loading = $state(false);
	let error = $state('');

	// Form is valid when both fields have values
	let isValid = $derived(campaignSlug.trim() && accessToken.trim());
</script>

<div class="flex min-h-screen items-center justify-center bg-gray-100">
	<div class="w-full max-w-md rounded-lg bg-white p-6 shadow-md">
		<h1 class="mb-6 text-center text-2xl font-bold">D&D Campaign Map</h1>

		<form
			method="POST"
			action="?/access"
			use:enhance={() => {
				loading = true;
				error = '';
				return async ({ result }) => {
					loading = false;
					if (result.type === 'redirect') {
						goto(result.location);
					} else if (result.type === 'failure') {
						interface FailureData {
							message?: string;
						}
						const failureData = result.data as FailureData | undefined;
						error = failureData?.message || 'Access denied';
					}
				};
			}}
		>
			<div class="mb-4">
				<label for="campaignSlug" class="mb-2 block text-sm font-medium text-gray-700">
					Campaign Code
				</label>
				<input
					id="campaignSlug"
					name="campaignSlug"
					type="text"
					required
					bind:value={campaignSlug}
					class="w-full rounded-md border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
					placeholder="Enter campaign code"
				/>
			</div>

			<div class="mb-6">
				<label for="accessToken" class="mb-2 block text-sm font-medium text-gray-700">
					Access Token
				</label>
				<input
					id="accessToken"
					name="accessToken"
					type="password"
					required
					bind:value={accessToken}
					class="w-full rounded-md border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
					placeholder="Enter access token"
				/>
			</div>

			{#if error}
				<div class="mb-4 rounded border border-red-400 bg-red-100 p-3 text-red-700">
					{error}
				</div>
			{/if}

			<button
				type="submit"
				disabled={loading || !isValid}
				class="w-full rounded-md bg-blue-600 px-4 py-2 text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
			>
				{loading ? 'Accessing...' : 'Access Campaign'}
			</button>
		</form>
	</div>
</div>
