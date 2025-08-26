<script lang="ts">
	import type { LayoutProps } from './$types';
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';

	let { data, children }: LayoutProps = $props();

	let showLogoutConfirm = $state(false);
</script>

<div class="min-h-screen bg-gradient-to-br to-blue-50 from-slate-50">
	<!-- Header -->
	<header class="bg-white border-b shadow-sm">
		<div class="px-4 mx-auto max-w-7xl sm:px-6 lg:px-8">
			<div class="flex justify-between items-center h-16">
				<div class="flex items-center space-x-4">
					<div class="flex items-center space-x-3">
						<div
							class="flex justify-center items-center w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg"
						>
							<svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-1.447-.894L15 4m0 13V4m0 0L9 7"
								/>
							</svg>
						</div>
						<div>
							<h1 class="text-xl font-semibold text-gray-900">{data.campaign.name}</h1>
							<p class="text-sm text-gray-500">Explorer View</p>
						</div>
					</div>
				</div>

				<div class="flex items-center space-x-6">
					<div class="hidden items-center space-x-4 text-sm text-gray-600 sm:flex">
						<div class="flex items-center space-x-2">
							<svg
								class="w-4 h-4 text-green-500"
								fill="none"
								stroke="currentColor"
								viewBox="0 0 24 24"
							>
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
								/>
							</svg>
							<span>Explored: <strong>{data.revealedTiles.length}</strong></span>
						</div>
						<div class="flex items-center space-x-2">
							<svg
								class="w-4 h-4 text-blue-500"
								fill="none"
								stroke="currentColor"
								viewBox="0 0 24 24"
							>
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
								/>
							</svg>
							<span>Points: <strong>{data.pointsOfInterest.length}</strong></span>
						</div>
						<div class="flex items-center space-x-2">
							<svg
								class="w-4 h-4 text-purple-500"
								fill="none"
								stroke="currentColor"
								viewBox="0 0 24 24"
							>
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5"
								/>
							</svg>
							<span>Notes: <strong>{data.tileNotes.length}</strong></span>
						</div>
					</div>

					<button
						onclick={() => (showLogoutConfirm = true)}
						class="flex items-center space-x-1 text-sm text-gray-600 transition-colors hover:text-gray-800"
					>
						<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
							/>
						</svg>
						<span>Logout</span>
					</button>
				</div>
			</div>
		</div>
	</header>

	<!-- Main content -->
	<main class="py-6 px-4 mx-auto max-w-7xl sm:px-6 lg:px-8">
		{@render children()}
	</main>
</div>

<!-- Logout confirmation modal -->
{#if showLogoutConfirm}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="flex fixed inset-0 z-50 justify-center items-center bg-black bg-opacity-50"
		onclick={(e) => {
			if (e.target === e.currentTarget) showLogoutConfirm = false;
		}}
	>
		<div class="p-6 mx-4 w-full max-w-sm bg-white rounded-lg">
			<h3 class="mb-4 text-lg font-medium text-gray-900">Leave Campaign?</h3>
			<p class="mb-6 text-sm text-gray-600">
				Are you sure you want to logout and return to the main page?
			</p>

			<div class="flex space-x-3">
				<button
					onclick={() => (showLogoutConfirm = false)}
					class="flex-1 py-2 px-4 text-sm text-gray-700 bg-gray-100 rounded-md transition-colors hover:bg-gray-200"
				>
					Stay
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
