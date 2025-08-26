<script lang="ts">
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import type { LayoutProps } from './$types';

	let { data, children }: LayoutProps = $props();
	let showLogoutConfirm = $state(false);
</script>

<div class="min-h-screen bg-gray-50">
	<header class="border-b bg-white shadow-sm">
		<div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
			<div class="flex h-16 items-center justify-between">
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

	<main class="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
		{@render children()}
	</main>
</div>

<!-- Logout confirmation modal -->
{#if showLogoutConfirm}
	<div
		role="presentation"
		class="bg-opacity-50 fixed inset-0 z-50 flex items-center justify-center bg-black"
		onclick={(e) => {
			if (e.target === e.currentTarget) showLogoutConfirm = false;
		}}
		onkeydown={(e) => {
			if (e.key === 'Escape') showLogoutConfirm = false;
		}}
	>
		<div class="mx-4 w-full max-w-sm rounded-lg bg-white p-6">
			<h3 class="mb-4 text-lg font-medium text-gray-900">Confirm Logout</h3>
			<p class="mb-6 text-sm text-gray-600">Are you sure you want to logout?</p>

			<div class="flex space-x-3">
				<button
					onclick={() => (showLogoutConfirm = false)}
					class="flex-1 rounded-md bg-gray-100 px-4 py-2 text-sm text-gray-700 transition-colors hover:bg-gray-200"
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
						class="w-full rounded-md bg-red-600 px-4 py-2 text-sm text-white transition-colors hover:bg-red-700"
					>
						Logout
					</button>
				</form>
			</div>
		</div>
	</div>
{/if}
