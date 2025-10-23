<script lang="ts">
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';

	let campaignName = $state('');
	let accessToken = $state('');
	let loading = $state(false);
	let error = $state('');

	// Form is valid when both fields have values
	let isValid = $derived(campaignName.trim() && accessToken.trim());
</script>

<div class="flex justify-center items-center min-h-screen bg-gray-100">
	<div class="p-6 w-full max-w-md bg-white rounded-lg shadow-md">
		<h1 class="mb-6 text-2xl font-bold text-center">Create campaign</h1>

		<form
			method="POST"
			action="?/create"
			use:enhance={() => {
				loading = true;
				error = '';
				return async ({ result }) => {
					loading = false;
					if (result.type === 'redirect') {
						goto(result.location);
					} else if (result.type === 'failure') {
						interface FailureData {
							error?: string;
						}
						const failureData = result.data as FailureData | undefined;
						error = failureData?.error || 'Access denied';
					}
				};
			}}
		>
			<div class="mb-4">
				<label for="campaignName" class="block mb-2 text-sm font-medium text-gray-700">
					Campaign Name
				</label>
				<input
					id="campaignName"
					name="campaignName"
					type="text"
					required
					bind:value={campaignName}
					class="py-2 px-3 w-full rounded-md border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:outline-none"
					placeholder="Enter campaign name"
				/>
			</div>
			<div class="mb-6">
				<label for="accessToken" class="block mb-2 text-sm font-medium text-gray-700">
					Super Secret DM Code
				</label>
				<input
					id="accessToken"
					name="accessToken"
					type="password"
					required
					bind:value={accessToken}
					class="py-2 px-3 w-full rounded-md border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:outline-none"
					placeholder="Enter DM Code"
				/>
			</div>

			{#if error}
				<div class="p-3 mb-4 text-red-700 bg-red-100 rounded border border-red-400">
					{error}
				</div>
			{/if}

			<button
				type="submit"
				disabled={loading || !isValid}
				class="py-2 px-4 w-full text-white bg-blue-600 rounded-md transition-colors hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
			>
				{loading ? 'Creating...' : 'Create campaign'}
			</button>
		</form>
	</div>
</div>
