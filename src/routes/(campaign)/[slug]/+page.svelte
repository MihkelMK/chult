<script lang="ts">
	import type { PageData } from './$types';
	import { goto } from '$app/navigation';

	interface Props {
		data: PageData;
	}

	let { data }: Props = $props();

	// Quick stats
	let exploredPercentage = $derived.by(() => {
		// Rough estimate based on revealed tiles (you could make this more accurate)
		const totalEstimated = 1000; // Rough estimate of total explorable tiles
		return Math.round((data.revealedTiles.length / totalEstimated) * 100);
	});

	let recentPOIs = $derived.by(() => {
		return data.mapMarkers
			.filter((m) => m.type === 'poi')
			.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
			.slice(0, 3);
	});

	let recentNotes = $derived.by(() => {
		return data.mapMarkers
			.filter((m) => m.type === 'note')
			.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
			.slice(0, 3);
	});
</script>

<svelte:head>
	<title>Explore {data.campaign.name}</title>
</svelte:head>

<div class="space-y-8">
	<!-- Welcome Section -->
	<div class="text-center">
		<h1 class="mb-4 text-4xl font-bold text-gray-900">
			Welcome to {data.campaign.name}
		</h1>
		<p class="mx-auto max-w-3xl text-xl text-gray-600">
			Explore the world, discover hidden locations, and document your adventures. Click on adjacent
			tiles to navigate and uncover new areas.
		</p>
	</div>

	<!-- Quick Stats -->
	<div class="grid grid-cols-1 gap-6 md:grid-cols-3">
		<div class="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
			<div class="flex items-center">
				<div class="flex-shrink-0">
					<div class="flex h-12 w-12 items-center justify-center rounded-lg bg-green-100">
						<svg
							class="h-6 w-6 text-green-600"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-1.447-.894L15 4m0 13V4m0 0L9 7"
							/>
						</svg>
					</div>
				</div>
				<div class="ml-4">
					<p class="text-sm font-medium text-gray-600">Exploration Progress</p>
					<div class="flex items-baseline">
						<p class="text-2xl font-semibold text-gray-900">{data.revealedTiles.length}</p>
						<p class="ml-2 text-sm text-gray-500">tiles explored</p>
					</div>
					<div class="mt-2 h-2 w-full rounded-full bg-gray-200">
						<div
							class="h-2 rounded-full bg-green-600 transition-all duration-500"
							style="width: {Math.min(exploredPercentage, 100)}%"
						></div>
					</div>
				</div>
			</div>
		</div>

		<div class="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
			<div class="flex items-center">
				<div class="flex-shrink-0">
					<div class="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-100">
						<svg
							class="h-6 w-6 text-blue-600"
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
					</div>
				</div>
				<div class="ml-4">
					<p class="text-sm font-medium text-gray-600">Points of Interest</p>
					<div class="flex items-baseline">
						<p class="text-2xl font-semibold text-gray-900">
							{data.mapMarkers.filter((m) => m.type === 'poi').length}
						</p>
						<p class="ml-2 text-sm text-gray-500">discovered</p>
					</div>
					<p class="mt-1 text-xs text-gray-500">Locations of note</p>
				</div>
			</div>
		</div>

		<div class="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
			<div class="flex items-center">
				<div class="flex-shrink-0">
					<div class="flex h-12 w-12 items-center justify-center rounded-lg bg-purple-100">
						<svg
							class="h-6 w-6 text-purple-600"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
							/>
						</svg>
					</div>
				</div>
				<div class="ml-4">
					<p class="text-sm font-medium text-gray-600">Journal Entries</p>
					<div class="flex items-baseline">
						<p class="text-2xl font-semibold text-gray-900">
							{data.mapMarkers.filter((m) => m.type === 'note').length}
						</p>
						<p class="ml-2 text-sm text-gray-500">notes written</p>
					</div>
					<p class="mt-1 text-xs text-gray-500">Your discoveries</p>
				</div>
			</div>
		</div>
	</div>

	<!-- Main Actions -->
	<div class="rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
		<div class="mb-8 text-center">
			<h2 class="mb-2 text-2xl font-semibold text-gray-900">Ready to Explore?</h2>
			<p class="text-gray-600">Open the interactive map to continue your journey</p>
		</div>

		{#if data.hasMapImage}
			<div class="flex justify-center">
				<button
					onclick={() => goto(`/${data.campaign.slug}/map`)}
					class="inline-flex transform items-center rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 px-8 py-4 text-white shadow-lg transition-all hover:scale-105 hover:from-blue-700 hover:to-purple-700"
				>
					<svg class="mr-3 h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-1.447-.894L15 4m0 13V4m0 0L9 7"
						/>
					</svg>
					<span class="text-lg font-semibold">Open Interactive Map</span>
				</button>
			</div>
		{:else}
			<div class="text-center">
				<div
					class="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100"
				>
					<svg class="h-8 w-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
						/>
					</svg>
				</div>
				<h3 class="mb-2 text-lg font-medium text-gray-900">Map Coming Soon</h3>
				<p class="text-gray-600">Your DM is preparing the world map. Check back soon!</p>
			</div>
		{/if}
	</div>

	<!-- Recent Activity -->
	<div class="grid grid-cols-1 gap-8 lg:grid-cols-2">
		<!-- Recent Points of Interest -->
		<div class="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
			<div class="mb-6 flex items-center justify-between">
				<h3 class="text-lg font-semibold text-gray-900">Recent Discoveries</h3>
				<svg class="h-5 w-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
					/>
				</svg>
			</div>

			{#if recentPOIs.length > 0}
				<div class="space-y-4">
					{#each recentPOIs as poi (poi.id)}
						<div class="flex items-start space-x-3 rounded-lg bg-blue-50 p-3">
							<div class="mt-2 h-2 w-2 rounded-full bg-blue-500"></div>
							<div class="min-w-0 flex-1">
								<p class="text-sm font-medium text-gray-900">{poi.title}</p>
								{#if poi.content}
									<p class="mt-1 text-sm text-gray-600">{poi.content}</p>
								{/if}
								<p class="mt-2 text-xs text-gray-500">
									Tile {poi.x + 1},{poi.y + 1} • {new Date(poi.createdAt).toLocaleDateString()}
								</p>
							</div>
						</div>
					{/each}
				</div>
			{:else}
				<div class="py-8 text-center">
					<div
						class="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100"
					>
						<svg
							class="h-6 w-6 text-gray-400"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
							/>
						</svg>
					</div>
					<p class="text-gray-500">
						No discoveries yet. Start exploring to find interesting locations!
					</p>
				</div>
			{/if}
		</div>

		<!-- Recent Notes -->
		<div class="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
			<div class="mb-6 flex items-center justify-between">
				<h3 class="text-lg font-semibold text-gray-900">Recent Journal Entries</h3>
				<svg class="h-5 w-5 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5"
					/>
				</svg>
			</div>

			{#if recentNotes.length > 0}
				<div class="space-y-4">
					{#each recentNotes as note (note.id)}
						<div class="rounded-lg bg-purple-50 p-3">
							<p class="text-sm text-gray-900">{note.content}</p>
							<p class="mt-2 text-xs text-gray-500">
								Tile {note.x + 1},{note.y + 1} • {new Date(note.createdAt).toLocaleDateString()}
							</p>
						</div>
					{/each}
				</div>
			{:else}
				<div class="py-8 text-center">
					<div
						class="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100"
					>
						<svg
							class="h-6 w-6 text-gray-400"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
							/>
						</svg>
					</div>
					<p class="text-gray-500">
						No journal entries yet. Document your adventures as you explore!
					</p>
				</div>
			{/if}
		</div>
	</div>
</div>
