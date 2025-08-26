<script lang="ts">
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import type { LayoutProps } from './$types';

	let { data, children }: LayoutProps = $props();
	let showLogoutConfirm = $state(false);
</script>

<div class="min-h-screen bg-gray-50">
	<header class="bg-white border-b shadow-sm">
		<div class="px-4 mx-auto max-w-7xl sm:px-6 lg:px-8">
			<div class="flex justify-between items-center h-16">
				<div class="flex items-center">
					<h1 class="text-xl font-semibold text-gray-900">
						{data.session.campaignSlug} - DM View
					</h1>
				</div>

				<div class="flex items-center space-x-4">
					<span class="text-sm text-gray-500">
						Campaign: {data.session.campaignSlug}
					</span>

					<button
						onclick={() => (showLogoutConfirm = true)}
						class="text-sm text-red-600 transition-colors hover:text-red-800"
					>
						Logout
					</button>
				</div>
			</div>
		</div>
	</header>

	<main class="py-6 px-4 mx-auto max-w-7xl sm:px-6 lg:px-8">
		{@render children()}
	</main>
</div>

<!-- Logout confirmation modal -->
{#if showLogoutConfirm}
	<!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
	<div
		class="flex fixed inset-0 z-50 justify-center items-center bg-black bg-opacity-50"
		onclick={(e) => {
			if (e.target === e.currentTarget) showLogoutConfirm = false;
		}}
	>
		<div class="p-6 mx-4 w-full max-w-sm bg-white rounded-lg">
			<h3 class="mb-4 text-lg font-medium text-gray-900">Confirm Logout</h3>
			<p class="mb-6 text-sm text-gray-600">Are you sure you want to logout?</p>

			<div class="flex space-x-3">
				<button
					onclick={() => (showLogoutConfirm = false)}
					class="flex-1 py-2 px-4 text-sm text-gray-700 bg-gray-100 rounded-md transition-colors hover:bg-gray-200"
				>
					Cancel
				</button>

				<form
					method="POST"
					action="?/logout"
					class="flex-1"
					use:enhance={() => {
						showLogoutConfirm = false;
						return async ({ result }) => {
							if (result.type === 'redirect') {
								goto(result.location);
							}
						};
					}}
				>
					<button
						type="submit"
						class="py-2 px-4 w-full text-sm text-white bg-red-600 rounded-md transition-colors hover:bg-red-700"
					>
						Logout
					</button>
				</form>
			</div>
		</div>
	</div>
{/if}
