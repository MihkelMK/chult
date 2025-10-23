<script lang="ts">
	import { page } from '$app/state';
	import MapCanvasWrapper from '$lib/components/map/MapCanvasWrapper.svelte';
	import MapUpload from '$lib/components/map/MapUpload.svelte';
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
	import { getLocalState } from '$lib/contexts/campaignContext';
	import {
		AlertCircle,
		Check,
		Copy,
		Crown,
		Eye,
		EyeOff,
		Map as MapIcon,
		Settings,
		Users,
		ZoomIn,
		ZoomOut
	} from '@lucide/svelte';
	import { SvelteSet } from 'svelte/reactivity';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	// Welcome message state
	const isNewCampaign = page.params.created === 'created';
	const localState = getLocalState();

	// Token visibility state
	let showDmToken = $state(false);
	let showPlayerToken = $state(false);
	let dmTokenCopied = $state(false);
	let playerTokenCopied = $state(false);

	// Map configuration state - initialize from database values
	let canvasWidth = $state(0);
	let canvasHeight = $state(0);
	let aspectRatio = $derived(Math.fround(data.campaign.imageHeight / data.campaign.imageWidth));
	let tilesPerColumn = $state(data.campaign?.hexesPerCol ?? 20);
	let tilesPerRow = $state(data.campaign?.hexesPerRow ?? 20);
	let offsetX = $state(data.campaign?.hexOffsetX ?? 70);
	let offsetY = $state(data.campaign?.hexOffsetY ?? 58);
	let previewZoom = $state(1);

	// Track if settings have changed
	let hasUnsavedChanges = $derived(
		tilesPerColumn !== (data.campaign?.hexesPerCol ?? 20) ||
			tilesPerRow !== (data.campaign?.hexesPerRow ?? 20) ||
			offsetX !== (data.campaign?.hexOffsetX ?? 70) ||
			offsetY !== (data.campaign?.hexOffsetY ?? 58)
	);

	// Copy token functions
	async function copyToken(token: string, type: 'dm' | 'player') {
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

	// Map upload callback
	function handleMapUploaded() {
		// Refresh the page data or handle map upload success
		location.reload();
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
			const response = await fetch(`/api/campaigns/${data.campaign?.slug}/map/settings`, {
				method: 'PATCH',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					hexesPerRow: tilesPerRow,
					hexesPerCol: tilesPerColumn,
					hexOffsetX: offsetX,
					hexOffsetY: offsetY
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
</script>

<svelte:head>
	<title>Settings - {data.campaign?.name}</title>
</svelte:head>

<div class="container p-6 mx-auto space-y-8 max-w-4xl">
	<!-- Welcome Message for New Campaigns -->
	{#if isNewCampaign}
		<Card class="bg-green-50 border-green-200">
			<CardHeader>
				<div class="flex gap-2 items-center">
					<Crown class="w-5 h-5 text-green-600" />
					<CardTitle class="text-green-800">Welcome, Dungeon Master!</CardTitle>
				</div>
				<CardDescription class="text-green-700">
					Your campaign "{data.campaign?.name}" has been created successfully. Get started by
					uploading a map and configuring your hex grid settings.
				</CardDescription>
			</CardHeader>
		</Card>
	{/if}

	<!-- Page Header -->
	<div class="flex justify-between">
		<div class="flex gap-3 items-center">
			<Settings class="w-6 h-6 text-muted-foreground" />
			<div>
				<h1 class="text-2xl font-bold">Campaign Settings</h1>
				<p class="text-muted-foreground">Configure your campaign map and access tokens</p>
			</div>
		</div>
		<div
			class="flex gap-2 items-center p-2 rounded-lg border bg-background/95 shadow-xs backdrop-blur-sm"
		>
			<Button href="/{data.campaign.slug}" variant="link" size="sm" type="submit">
				<MapIcon class="mr-2 w-4 h-4" />
				Back
			</Button>
		</div>
	</div>

	<div class="grid gap-8 md:grid-cols-2">
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
							<div class="flex-1 p-3 font-mono text-sm rounded-md bg-muted">
								{showDmToken ? data.dmToken : '****************'}
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
								onclick={() => copyToken(data.dmToken || '', 'dm')}
							>
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
							<div class="flex-1 p-3 font-mono text-sm rounded-md bg-muted">
								{showPlayerToken ? data.playerToken : '****************'}
							</div>
							<Button
								variant="outline"
								size="sm"
								onclick={() => (showPlayerToken = !showPlayerToken)}
							>
								{#if showPlayerToken}
									<EyeOff class="w-4 h-4" />
								{:else}
									<Eye class="w-4 h-4" />
								{/if}
							</Button>
							<Button
								variant="outline"
								size="sm"
								onclick={() => copyToken(data.playerToken || '', 'player')}
							>
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
								class="w-full"
							/>
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
								class="w-full"
							/>
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
								class="w-full"
							/>
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
								class="w-full"
							/>
						</div>
					</div>

					<!-- Save Status and Button -->
					{#if saveError}
						<div
							class="flex gap-2 items-center p-3 text-sm rounded-md bg-destructive/15 text-destructive"
						>
							<AlertCircle class="w-4 h-4" />
							<span>{saveError}</span>
						</div>
					{/if}

					{#if saveSuccess}
						<div class="flex gap-2 items-center p-3 text-sm text-green-800 bg-green-50 rounded-md">
							<Check class="w-4 h-4" />
							<span>Hex grid configuration saved successfully!</span>
						</div>
					{/if}

					<!-- Save Controls -->
					<Button
						onclick={saveHexGridConfig}
						disabled={!hasUnsavedChanges || saving}
						class="w-full"
					>
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
		</div>

		<!-- Right Column: Map Preview and Access Tokens -->
		<div class="space-y-6">
			<!-- Map Upload Section -->
			<Card>
				<CardHeader>
					<CardTitle>Map Management</CardTitle>
					<CardDescription>Upload and manage your campaign map</CardDescription>
				</CardHeader>
				<CardContent>
					<MapUpload
						campaignSlug={data.campaign?.slug}
						mapUrls={data.mapUrls}
						onMapUploaded={handleMapUploaded}
					/>
				</CardContent>
			</Card>

			<!-- Map Preview Section -->
			{#if data.mapUrls}
				<Card>
					<CardHeader>
						<CardTitle>Map Preview</CardTitle>
						<CardDescription>Preview your map with hex grid overlay</CardDescription>
					</CardHeader>
					<CardContent>
						<div
							class="overflow-hidden relative rounded-lg min-h-80"
							bind:clientHeight={canvasHeight}
							bind:clientWidth={canvasWidth}
							style="aspect-ratio: 1/{aspectRatio};"
						>
							<MapCanvasWrapper
								mapUrls={data.mapUrls}
								previewMode={true}
								{localState}
								{canvasHeight}
								{canvasWidth}
								variant="detail"
								hexesPerRow={tilesPerRow}
								hexesPerCol={tilesPerColumn}
								xOffset={offsetX}
								yOffset={offsetY}
								imageHeight={data.campaign.imageHeight}
								imageWidth={data.campaign.imageWidth}
								showAnimations={false}
								showCoords="never"
								zoom={previewZoom}
								cursorMode="pan"
								hasPoI={() => false}
								hasNotes={() => false}
								isPlayerPosition={() => false}
								onHexTriggered={() => {}}
								selectedSet={new SvelteSet<string>()}
								showAlwaysRevealed={true}
								showRevealed={true}
								isDM={true}
								isDragging={false}
							/>

							<!-- Overlay Controls -->
							<div class="flex absolute top-2 right-2 gap-1">
								<!-- Zoom Toggle -->
								<Button
									variant="outline"
									size="sm"
									onclick={() => ((previewZoom = Math.min(previewZoom + 2)), 10)}
									class="p-0 w-8 h-8 bg-background/90 backdrop-blur-sm"
								>
									<ZoomIn class="w-3 h-3" />
								</Button>
								<Button
									variant="outline"
									size="sm"
									onclick={() => (previewZoom = Math.max(previewZoom - 2, 1))}
									class="p-0 w-8 h-8 bg-background/90 backdrop-blur-sm"
								>
									<ZoomOut class="w-3 h-3" />
								</Button>
							</div>
						</div>
					</CardContent>
				</Card>
			{/if}
		</div>
	</div>
</div>
