<script lang="ts">
	import type { PageData } from './$types';
	import MapUpload from '$lib/components/MapUpload.svelte';
	import { invalidate } from '$app/navigation';

	interface Props {
		data: PageData;
	}

	let { data }: Props = $props();

	function handleMapUploaded() {
		// Refresh the page data to update hasMapImage status
		invalidate('campaign:data');
	}
</script>

<div class="space-y-8">
	<!-- Campaign Overview -->
	<div class="rounded-lg border border-gray-200 bg-white shadow-sm">
		<div class="p-6">
			<div class="flex items-start justify-between">
				<div>
					<h1 class="text-3xl font-bold text-gray-900">{data.campaign.name}</h1>
					<p class="mt-1 text-lg text-gray-600">Campaign: {data.campaign.slug}</p>
				</div>

				<div class="space-y-1 text-right text-sm text-gray-600">
					<div class="flex items-center space-x-2">
						<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
							/>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
							/>
						</svg>
						<span>Revealed: <strong>{data.revealedTiles.length}</strong> tiles</span>
					</div>
					<div class="flex items-center space-x-2">
						<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
							/>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
							/>
						</svg>
						<span>POIs: <strong>{data.pointsOfInterest.length}</strong></span>
					</div>
					<div class="flex items-center space-x-2">
						<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
							/>
						</svg>
						<span>Notes: <strong>{data.tileNotes.length}</strong></span>
					</div>
				</div>
			</div>
		</div>
	</div>

	<!-- Map Management -->
	<MapUpload
		hasMapImage={data.hasMapImage}
		campaignSlug={data.campaign.slug}
		onMapUploaded={handleMapUploaded}
	/>

	<!-- Quick Actions -->
	<div class="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
		<a
			href="/dm/{data.campaign.slug}/map"
			class="group rounded-lg border border-gray-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md"
		>
			<div class="flex items-center">
				<div class="flex-shrink-0">
					<svg class="h-8 w-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-1.447-.894L15 4m0 13V4m0 0L9 7"
						/>
					</svg>
				</div>
				<div class="ml-4">
					<h3 class="text-lg font-medium text-gray-900 group-hover:text-blue-600">
						Interactive Map
					</h3>
					<p class="text-sm text-gray-600">Manage hex reveals and player view</p>
				</div>
			</div>
		</a>

		<a
			href="/dm/{data.campaign.slug}/pois"
			class="group rounded-lg border border-gray-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md"
		>
			<div class="flex items-center">
				<div class="flex-shrink-0">
					<svg class="h-8 w-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
						/>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
						/>
					</svg>
				</div>
				<div class="ml-4">
					<h3 class="text-lg font-medium text-gray-900 group-hover:text-green-600">
						Points of Interest
					</h3>
					<p class="text-sm text-gray-600">Add and manage POIs on the map</p>
				</div>
			</div>
		</a>

		<a
			href="/dm/{data.campaign.slug}/sessions"
			class="group rounded-lg border border-gray-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md"
		>
			<div class="flex items-center">
				<div class="flex-shrink-0">
					<svg
						class="h-8 w-8 text-purple-600"
						fill="none"
						stroke="currentColor"
						viewBox="0 0 24 24"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
						/>
					</svg>
				</div>
				<div class="ml-4">
					<h3 class="text-lg font-medium text-gray-900 group-hover:text-purple-600">
						Game Sessions
					</h3>
					<p class="text-sm text-gray-600">Track and replay player paths</p>
				</div>
			</div>
		</a>

		<a
			href="/{data.campaign.slug}"
			target="_blank"
			class="group rounded-lg border border-gray-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md"
		>
			<div class="flex items-center">
				<div class="flex-shrink-0">
					<svg
						class="h-8 w-8 text-orange-600"
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
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
						/>
					</svg>
				</div>
				<div class="ml-4">
					<h3 class="text-lg font-medium text-gray-900 group-hover:text-orange-600">Player View</h3>
					<p class="text-sm text-gray-600">See what players see</p>
				</div>
			</div>
		</a>
	</div>

	<!-- Recent Activity -->
	{#if data.gameSessions && data.gameSessions.length > 0}
		<div class="rounded-lg border border-gray-200 bg-white shadow-sm">
			<div class="p-6">
				<h2 class="mb-4 text-lg font-medium text-gray-900">Recent Sessions</h2>
				<div class="space-y-3">
					{#each data.gameSessions || [] as session (session.id)}
						<div
							class="flex items-center justify-between border-b border-gray-100 py-3 last:border-0"
						>
							<div>
								<span class="font-medium text-gray-900">{session.name}</span>
								<span class="ml-3 text-sm text-gray-500">
									{new Date(session.startTime).toLocaleDateString('en-US', {
										weekday: 'short',
										year: 'numeric',
										month: 'short',
										day: 'numeric'
									})}
								</span>
							</div>
							<a
								href="/replay/{data.campaign.slug}/{session.id}"
								class="text-sm font-medium text-blue-600 hover:text-blue-800"
							>
								View Replay →
							</a>
						</div>
					{/each}
				</div>
			</div>
		</div>
	{/if}
</div>
