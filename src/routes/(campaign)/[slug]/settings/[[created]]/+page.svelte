<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { page } from '$app/state';
	import MapCanvasWrapper from '$lib/components/canvas/MapCanvasWrapper.svelte';
	import MapUpload from '$lib/components/forms/MapUpload.svelte';
	import ViewAsToggle from '$lib/components/forms/ViewAsToggle.svelte';
	import ZoomControls from '$lib/components/map/overlays/ZoomControls.svelte';
	import * as Alert from '$lib/components/ui/alert/index.js';
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import {
		Card,
		CardContent,
		CardDescription,
		CardHeader,
		CardTitle
	} from '$lib/components/ui/card';
	import { Separator } from '$lib/components/ui/separator';
	import { Slider } from '$lib/components/ui/slider';
	import * as Tooltip from '$lib/components/ui/tooltip';
	import { getLocalState } from '$lib/contexts/campaignContext';
	import type { UserRole } from '$lib/types';
	import {
		Check,
		CircleAlert,
		Copy,
		Crown,
		Eye,
		EyeOff,
		Flag,
		Hand,
		Map,
		Users
	} from '@lucide/svelte';
	import { Debounced } from 'runed';
	import { SvelteSet } from 'svelte/reactivity';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	// Welcome message state
	const isNewCampaign = page.url.searchParams.get('created');
	const localState = getLocalState();

	// Token visibility state
	let showDmToken = $state(false);
	let showPlayerToken = $state(false);
	let dmTokenCopied = $state(false);
	let playerTokenCopied = $state(false);

	// Map configuration state - initialize from database values
	let viewAs: UserRole = $state('dm');
	let canvasWidth = $state(0);
	let canvasHeight = $state(0);
	let aspectRatio = $derived(Math.fround(data.campaign.imageHeight / data.campaign.imageWidth));
	let tilesPerColumn = $state(data.campaign?.hexesPerCol);
	let tilesPerRow = $state(data.campaign?.hexesPerRow);
	let offsetX = $state(data.campaign?.hexOffsetX);
	let offsetY = $state(data.campaign?.hexOffsetY);

	let tilesPerColumnDebounced = new Debounced(() => tilesPerColumn, 1000);
	let tilesPerRowDebounced = new Debounced(() => tilesPerRow, 1000);
	let offsetXDebounced = new Debounced(() => offsetX, 250);
	let offsetYDebounced = new Debounced(() => offsetY, 250);

	// Map preview state
	const zoomSteps = [1, 2, 3, 4, 5, 6, 10];
	let previewZoomIndex = $state(0);
	let previewZoom = $derived(zoomSteps[previewZoomIndex]);
	let previewTool = $state<'pan' | 'set-position'>('pan');
	let isDragging = $state(false);

	// Party token position state
	let partyTokenX = $state<number | null>(data.campaign?.partyTokenX ?? null);
	let partyTokenY = $state<number | null>(data.campaign?.partyTokenY ?? null);

	// Player map state
	let hasPlayerMap = $state(data.campaign?.hasPlayerMap ?? false);

	// Check if any sessions exist - if so, disable manual position setting
	let hasAnySessions = $derived(localState.gameSessions.length > 0);

	// Track if settings have changed
	let hasUnsavedChanges = $derived(
		tilesPerColumn !== data.campaign?.hexesPerCol ||
			tilesPerRow !== data.campaign?.hexesPerRow ||
			offsetX !== data.campaign?.hexOffsetX ||
			offsetY !== data.campaign?.hexOffsetY
	);

	// Track if party token position has changed
	let hasUnsavedPartyPosition = $derived(
		partyTokenX !== (data.campaign?.partyTokenX ?? null) ||
			partyTokenY !== (data.campaign?.partyTokenY ?? null)
	);

	// Compute which map URLs to show based on viewAs toggle
	let displayMapUrls = $derived(
		viewAs !== 'dm' && hasPlayerMap && data.playerMapUrls
			? data.playerMapUrls
			: data.dmMapUrls || data.mapUrls
	);

	// Copy token functions
	async function copyToken(token: string, type: UserRole) {
		try {
			await navigator.clipboard.writeText(token);
			if (type === 'dm') {
				dmTokenCopied = true;
				setTimeout(() => (dmTokenCopied = false), 2000);
			} else {
				playerTokenCopied = true;
				setTimeout(() => (playerTokenCopied = false), 2000);
			}
		} catch (err) {
			console.error('Failed to copy token:', err);
		}
	}

	function handleViewAsToggle() {
		if (viewAs === 'dm') {
			viewAs = 'player';
		} else {
			viewAs = 'dm';
		}
	}

	// Map upload callback
	async function handleMapUploaded() {
		// Invalidate all data to refetch from server
		await invalidateAll();
	}

	// Handle player map deletion
	async function handlePlayerMapDeleted() {
		// Toggle off hasPlayerMap setting
		await togglePlayerMap(false);
	}

	// Handle hasPlayerMap toggle
	async function togglePlayerMap(enabled: boolean) {
		try {
			const response = await fetch(`/api/campaigns/${data.campaign.slug}/map/settings`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ hasPlayerMap: enabled })
			});

			if (!response.ok) {
				throw new Error('Failed to update player map setting');
			}

			hasPlayerMap = enabled;
			// Invalidate data to refetch hasPlayerMapFile
			await invalidateAll();
		} catch (err) {
			console.error('Failed to toggle player map:', err);
			// Revert the toggle on error
			hasPlayerMap = !enabled;
		}
	}

	// Save hex grid configuration
	let saving = $state(false);
	let saveError = $state('');
	let saveSuccess = $state(false);

	async function saveHexGridConfig() {
		if (!hasUnsavedChanges) return;

		saving = true;
		saveError = '';
		saveSuccess = false;

		try {
			tilesPerColumnDebounced.updateImmediately();
			tilesPerRowDebounced.updateImmediately();
			offsetXDebounced.updateImmediately();
			offsetYDebounced.updateImmediately();

			const response = await fetch(`/api/campaigns/${data.campaign?.slug}/map/settings`, {
				method: 'PATCH',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					hexesPerRow: tilesPerRowDebounced.current,
					hexesPerCol: tilesPerColumnDebounced.current,
					hexOffsetX: offsetXDebounced.current,
					hexOffsetY: offsetYDebounced.current
				})
			});

			if (!response.ok) {
				const errorData = await response.json();
				throw new Error(errorData.message || 'Failed to save configuration');
			}

			const result = await response.json();
			saveSuccess = true;

			// Update the data object to reflect the saved values
			if (data.campaign) {
				data.campaign.hexesPerRow = result.config.hexesPerRow;
				data.campaign.hexesPerCol = result.config.hexesPerCol;
				data.campaign.hexOffsetX = result.config.hexOffsetX;
				data.campaign.hexOffsetY = result.config.hexOffsetY;
			}

			// Clear success message after 3 seconds
			setTimeout(() => {
				saveSuccess = false;
			}, 3000);
		} catch (err) {
			saveError = err instanceof Error ? err.message : 'Failed to save configuration';
		} finally {
			saving = false;
		}
	}

	// Save party token position
	let savingPartyPosition = $state(false);
	let savePartyPositionError = $state('');
	let savePartyPositionSuccess = $state(false);

	async function savePartyTokenPosition() {
		if (!hasUnsavedPartyPosition) return;

		savingPartyPosition = true;
		savePartyPositionError = '';
		savePartyPositionSuccess = false;

		try {
			const response = await fetch(`/api/campaigns/${data.campaign?.slug}/map/settings`, {
				method: 'PATCH',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					partyTokenX,
					partyTokenY
				})
			});

			if (!response.ok) {
				const errorData = await response.json();
				throw new Error(errorData.message || 'Failed to save party token position');
			}

			const result = await response.json();
			savePartyPositionSuccess = true;

			// Update the data object to reflect the saved values
			if (data.campaign) {
				data.campaign.partyTokenX = result.config.partyTokenX;
				data.campaign.partyTokenY = result.config.partyTokenY;
			}

			// Clear success message after 3 seconds
			setTimeout(() => {
				savePartyPositionSuccess = false;
			}, 3000);
		} catch (err) {
			savePartyPositionError =
				err instanceof Error ? err.message : 'Failed to save party token position';
		} finally {
			savingPartyPosition = false;
		}
	}

	// Clear party token position
	function clearPartyTokenPosition() {
		partyTokenX = null;
		partyTokenY = null;
	}

	// Handle hex click on map preview to set party token position
	function handleHexClickForPartyPosition(event: { key: string }) {
		if (previewTool !== 'set-position') return;

		const [col, row] = event.key.split('-').map(Number);
		partyTokenX = col;
		partyTokenY = row;
	}

	// Zoom controls for preview
	function zoomInPreview() {
		if (previewZoomIndex < zoomSteps.length - 1) {
			previewZoomIndex += 1;
		}
	}

	function zoomOutPreview() {
		if (previewZoomIndex > 0) {
			previewZoomIndex -= 1;
		}
	}

	function resetZoomPreview() {
		previewZoomIndex = 0;
	}

	// Sync party token position to localState for map preview
	$effect(() => {
		if (partyTokenX !== null && partyTokenY !== null) {
			localState.partyTokenPosition = { x: partyTokenX, y: partyTokenY };
		} else {
			localState.partyTokenPosition = null;
		}
	});
</script>

<svelte:head>
	<title>Settings - {data.campaign?.name}</title>
</svelte:head>

<Tooltip.Provider>
	<div class="container p-6 mx-auto space-y-8 max-w-4xl">
		<!-- Page Header -->
		<div class="flex justify-between items-center">
			<div class="flex gap-3 items-center">
				<div>
					<h1 class="text-2xl font-bold">Campaign Settings</h1>
					<p class="text-muted-foreground">Configure your campaign map and access tokens</p>
				</div>
			</div>
			<div
				class="flex items-center p-1 rounded-lg border bg-background/95 shadow-xs backdrop-blur-sm">
				<Button href="/{data.campaign.slug}" variant="link" size="sm" type="submit">
					<Map class="mr-2 w-4 h-4" />
					Back
				</Button>
			</div>
		</div>

		<div class="grid gap-8 md:grid-cols-2">
			<!-- Welcome Message for New Campaigns -->
			{#if isNewCampaign}
				<Alert.Root class="col-span-2 bg-green-50 border-green-200">
					<Crown class="w-5 h-5 text-green-600" />
					<Alert.Title class="text-green-700">Welcome, Dungeon Master!</Alert.Title>
					<Alert.Description>
						<p>
							Your campaign "{data.campaign?.name}" has been created successfully.
							<br />
							Get started by
							<strong>uploading a map</strong>
							and configuring your
							<strong>hex grid settings.</strong>
						</p>
					</Alert.Description>
				</Alert.Root>
			{/if}
			<!-- Left Column: Map Upload and Configuration -->
			<div class="space-y-6">
				<!-- Access Tokens Section -->
				<Card>
					<CardHeader>
						<CardTitle>Access Tokens</CardTitle>
						<CardDescription>
							Share these links with your players and use the DM link yourself
						</CardDescription>
					</CardHeader>
					<CardContent class="space-y-4">
						<!-- DM Token -->
						<div class="space-y-2">
							<div class="flex gap-2 items-center">
								<Crown class="w-4 h-4 text-amber-600" />
								<!-- svelte-ignore a11y_label_has_associated_control -->
								<label class="text-sm font-medium">Dungeon Master Access</label>
								<Badge variant="secondary">DM</Badge>
							</div>

							<div class="flex gap-2">
								<div class="flex flex-1 items-center rounded-md bg-muted">
									<p class="p-1 font-mono text-sm">
										{showDmToken ? data.dmToken : '--------'}
									</p>
								</div>
								<Button variant="outline" size="sm" onclick={() => (showDmToken = !showDmToken)}>
									{#if showDmToken}
										<EyeOff class="w-4 h-4" />
									{:else}
										<Eye class="w-4 h-4" />
									{/if}
								</Button>
								<Button
									variant="outline"
									size="sm"
									onclick={() => copyToken(data.dmToken || '', 'dm')}>
									{#if dmTokenCopied}
										<Check class="w-4 h-4 text-green-600" />
									{:else}
										<Copy class="w-4 h-4" />
									{/if}
								</Button>
							</div>
						</div>

						<Separator />

						<!-- Player Token -->
						<div class="space-y-2">
							<div class="flex gap-2 items-center">
								<Users class="w-4 h-4 text-blue-600" />
								<!-- svelte-ignore a11y_label_has_associated_control -->
								<label class="text-sm font-medium">Player Access</label>
								<Badge variant="outline">Player</Badge>
							</div>

							<div class="flex gap-2">
								<div class="flex flex-1 items-center rounded-md bg-muted">
									<p class="p-1 font-mono text-sm">
										{showPlayerToken ? data.playerToken : '--------'}
									</p>
								</div>
								<Button
									variant="outline"
									size="sm"
									onclick={() => (showPlayerToken = !showPlayerToken)}>
									{#if showPlayerToken}
										<EyeOff class="w-4 h-4" />
									{:else}
										<Eye class="w-4 h-4" />
									{/if}
								</Button>
								<Button
									variant="outline"
									size="sm"
									onclick={() => copyToken(data.playerToken || '', 'player')}>
									{#if playerTokenCopied}
										<Check class="w-4 h-4 text-green-600" />
									{:else}
										<Copy class="w-4 h-4" />
									{/if}
								</Button>
							</div>
						</div>
					</CardContent>
				</Card>
				<!-- Map Configuration Section -->
				<Card>
					<CardHeader>
						<CardTitle>Hex Grid Configuration</CardTitle>
						<CardDescription>Adjust the hex grid overlay for your map</CardDescription>
					</CardHeader>
					<CardContent class="space-y-6">
						<!-- Grid Size Controls -->
						<div class="space-y-4">
							<div>
								<label class="block mb-2 text-sm font-medium" for="tilesPerColumnSlider">
									Tiles per Column: {tilesPerColumn}
								</label>
								<Slider
									id="tilesPerColumnSlider"
									type="single"
									bind:value={tilesPerColumn}
									min={5}
									max={100}
									step={1}
									class="w-full" />
							</div>

							<div>
								<label class="block mb-2 text-sm font-medium" for="tilesPerRowSlider">
									Tiles per Row: {tilesPerRow}
								</label>
								<Slider
									id="tilesPerRowSlider"
									type="single"
									bind:value={tilesPerRow}
									min={5}
									max={100}
									step={1}
									class="w-full" />
							</div>
						</div>

						<Separator />

						<!-- Offset Controls -->
						<div class="space-y-4">
							<div>
								<label class="block mb-2 text-sm font-medium" for="offsetXSlider">
									Horizontal Offset: {offsetX}px
								</label>
								<Slider
									id="offsetXSlider"
									type="single"
									bind:value={offsetX}
									min={-200}
									max={200}
									step={1}
									class="w-full" />
							</div>

							<div>
								<label class="block mb-2 text-sm font-medium" for="offsetYSlider">
									Vertical Offset: {offsetY}px
								</label>
								<Slider
									id="offsetYSlider"
									type="single"
									bind:value={offsetY}
									min={-200}
									max={200}
									step={1}
									class="w-full" />
							</div>
						</div>

						<!-- Save Status and Button -->
						{#if saveError}
							<div
								class="flex gap-2 items-center p-3 text-sm rounded-md bg-destructive/15 text-destructive">
								<CircleAlert class="w-4 h-4" />
								<span>{saveError}</span>
							</div>
						{/if}

						{#if saveSuccess}
							<div
								class="flex gap-2 items-center p-3 text-sm text-green-800 bg-green-50 rounded-md">
								<Check class="w-4 h-4" />
								<span>Hex grid configuration saved successfully!</span>
							</div>
						{/if}

						<!-- Save Controls -->
						<Button
							onclick={saveHexGridConfig}
							disabled={!hasUnsavedChanges || saving}
							class="w-full">
							{#if saving}
								Saving...
							{:else if hasUnsavedChanges}
								Save Configuration
							{:else}
								Configuration Saved
							{/if}
						</Button>
					</CardContent>
				</Card>

				<!-- Party Token Position Section -->
				<Card>
					<CardHeader>
						<CardTitle>Initial Party Token Position</CardTitle>
						<CardDescription>Set where Party Token is before the first session</CardDescription>
					</CardHeader>
					<CardContent class="space-y-4">
						{#if hasAnySessions}
							<!-- Session active message -->
							<div class="flex gap-2 items-center p-3 text-sm text-blue-800 bg-blue-50 rounded-md">
								<span>
									Party position cannot be changed manually once sessions have been created. Use the
									exploration system to move the party.
								</span>
							</div>
						{:else}
							<!-- Position Display -->
							<div class="space-y-2">
								{#if partyTokenX !== null && partyTokenY !== null}
									<div class="flex gap-2 items-center p-3 rounded-md bg-muted">
										<span class="font-mono text-sm">
											Column: {partyTokenX}, Row: {partyTokenY}
										</span>
										<Button variant="ghost" size="sm" onclick={clearPartyTokenPosition}>
											Clear
										</Button>
									</div>
								{:else}
									<div class="p-3 text-sm rounded-md bg-muted text-muted-foreground">
										No position set - party token will be placed at first session start
									</div>
								{/if}
							</div>

							<Separator />

							<!-- Set Position Instructions -->
							<div class="space-y-2">
								<p class="text-sm text-muted-foreground">
									Use the <Flag class="inline w-3 h-3" /> tool in the map preview
								</p>
							</div>
						{/if}

						{#if !hasAnySessions}
							<!-- Save Status and Button -->
							{#if savePartyPositionError}
								<div
									class="flex gap-2 items-center p-3 text-sm rounded-md bg-destructive/15 text-destructive">
									<CircleAlert class="w-4 h-4" />
									<span>{savePartyPositionError}</span>
								</div>
							{/if}

							{#if savePartyPositionSuccess}
								<div
									class="flex gap-2 items-center p-3 text-sm text-green-800 bg-green-50 rounded-md">
									<Check class="w-4 h-4" />
									<span>Party token position saved successfully!</span>
								</div>
							{/if}

							<!-- Save Controls -->
							<Button
								onclick={savePartyTokenPosition}
								disabled={!hasUnsavedPartyPosition || savingPartyPosition}
								class="w-full">
								{#if savingPartyPosition}
									Saving...
								{:else if hasUnsavedPartyPosition}
									Save Position
								{:else}
									Position Saved
								{/if}
							</Button>
						{/if}
					</CardContent>
				</Card>
			</div>

			<!-- Right Column: Map Preview and Access Tokens -->
			<div class="space-y-6">
				<!-- Map Upload Section -->
				<Card>
					<CardHeader>
						<CardTitle>Map Management</CardTitle>
						<CardDescription>Upload and manage the campaign map</CardDescription>
					</CardHeader>
					<CardContent class="space-y-6">
						<MapUpload
							campaignSlug={data.campaign?.slug}
							mapExists={!!data.mapUrls}
							onMapUploaded={handleMapUploaded}
							label="DM Map" />

						{#if hasPlayerMap}
							<MapUpload
								campaignSlug={data.campaign?.slug}
								mapExists={data.hasPlayerMapFile}
								onMapUploaded={handleMapUploaded}
								onDeleted={handlePlayerMapDeleted}
								mapType="player"
								label="Player Map" />
						{:else}
							<Button
								class="w-full cursor-pointer"
								size="sm"
								variant="ghost"
								onclick={() => (hasPlayerMap = true)}>
								Use separate Player map
							</Button>
						{/if}
					</CardContent>
				</Card>

				<!-- Map Preview Section -->
				{#if displayMapUrls}
					<Card>
						<CardHeader>
							<div class="flex justify-between align-center">
								<div>
									<CardTitle>Map Preview</CardTitle>
									<CardDescription>Preview hex grid on the map</CardDescription>
								</div>
								{#if hasPlayerMap}
									<ViewAsToggle effectiveRole={viewAs} onCheckedChange={handleViewAsToggle} />
								{/if}
							</div>
						</CardHeader>
						<CardContent>
							<div
								class="overflow-hidden relative rounded-lg min-h-80"
								bind:clientHeight={canvasHeight}
								bind:clientWidth={canvasWidth}
								style="aspect-ratio: 1/{aspectRatio}; cursor: {previewTool === 'pan'
									? isDragging
										? 'grabbing'
										: 'grab'
									: 'crosshair'};">
								<MapCanvasWrapper
									bind:isDragging
									mapUrls={displayMapUrls}
									previewMode={true}
									{localState}
									{canvasHeight}
									{canvasWidth}
									variant="detail"
									hexesPerRow={tilesPerRowDebounced.current}
									hexesPerCol={tilesPerColumnDebounced.current}
									xOffset={offsetXDebounced.current}
									yOffset={offsetYDebounced.current}
									imageHeight={data.campaign.imageHeight}
									imageWidth={data.campaign.imageWidth}
									activeSelectMode="remove"
									showAnimations={false}
									showCoords="never"
									zoom={previewZoom}
									activeTool={previewTool}
									selectedTool={previewTool}
									onHexTriggered={handleHexClickForPartyPosition}
									selectedSet={new SvelteSet<string>()}
									showAlwaysRevealed={true}
									showRevealed={true}
									isDM={true} />

								<!-- Toolbar Overlay -->
								{#if !hasAnySessions}
									<div
										class="flex absolute bottom-4 left-4 gap-1 p-1 rounded-lg border shadow-sm bg-background/95 backdrop-blur-sm">
										<!-- Pan Tool -->
										<Tooltip.Root>
											<Tooltip.Trigger>
												<Button
													variant={previewTool === 'pan' ? 'default' : 'ghost'}
													size="sm"
													onclick={() => (previewTool = 'pan')}
													class="p-0 w-8 h-8">
													<Hand class="w-4 h-4" />
												</Button>
											</Tooltip.Trigger>
											<Tooltip.Content>
												<p>Pan (drag to move)</p>
											</Tooltip.Content>
										</Tooltip.Root>

										<!-- Set Position Tool -->
										<Tooltip.Root>
											<Tooltip.Trigger>
												<Button
													variant={previewTool === 'set-position' ? 'default' : 'ghost'}
													size="sm"
													onclick={() => (previewTool = 'set-position')}
													class="p-0 w-8 h-8">
													<Flag class="w-4 h-4" />
												</Button>
											</Tooltip.Trigger>
											<Tooltip.Content>
												<p>Set Party Position (click tile)</p>
											</Tooltip.Content>
										</Tooltip.Root>
									</div>
								{/if}

								<!-- Zoom Controls -->
								<div class="absolute right-4 bottom-4 z-20">
									<ZoomControls
										zoom={previewZoom}
										onResetZoom={resetZoomPreview}
										onZoomIn={zoomInPreview}
										onZoomOut={zoomOutPreview} />
								</div>
							</div>
						</CardContent>
					</Card>
				{/if}
			</div>
		</div>
	</div>
</Tooltip.Provider>
