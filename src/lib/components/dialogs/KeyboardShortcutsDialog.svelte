<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import * as Dialog from '$lib/components/ui/dialog';
	import * as Kbd from '$lib/components/ui/kbd';
	import type { UserRole } from '$lib/types';
	import { Keyboard } from '@lucide/svelte';

	interface Props {
		effectiveRole: UserRole;
	}

	let { effectiveRole }: Props = $props();

	let open = $state(false);

	interface ShortcutSection {
		title: string;
		shortcuts: Array<{
			keys: string[];
			description: string;
			onlyFor?: UserRole;
		}>;
	}

	const shortcutSections: ShortcutSection[] = [
		{
			title: 'Tools',
			shortcuts: [
				{ keys: ['I'], description: 'Interact mode' },
				{ keys: ['S'], description: 'Select mode', onlyFor: 'dm' },
				{ keys: ['B'], description: 'Brush/Paint mode', onlyFor: 'dm' },
				{ keys: ['P'], description: 'Pan mode' },
				{ keys: ['E'], description: 'Explore mode', onlyFor: 'player' },
				{ keys: ['Shift'], description: 'Hold to temporarily pan' }
			]
		},
		{
			title: 'Selection',
			shortcuts: [
				{
					keys: ['Ctrl'],
					description: 'Hold to toggle selection mode (add/remove)',
					onlyFor: 'dm'
				},
				{ keys: ['Esc'], description: 'Clear selection or deselect tool', onlyFor: 'dm' },
				{ keys: ['Esc'], description: 'Deselect tool', onlyFor: 'player' },
				{ keys: ['Ctrl', 'Z'], description: 'Undo selection', onlyFor: 'dm' },
				{ keys: ['Ctrl', 'Shift', 'Z'], description: 'Redo selection', onlyFor: 'dm' }
			]
		},
		{
			title: 'Zoom',
			shortcuts: [
				{ keys: ['+'], description: 'Zoom in' },
				{ keys: ['-'], description: 'Zoom out' },
				{ keys: ['0'], description: 'Reset zoom' }
			]
		}
	];

	// Filter out DM-only shortcuts for players
	const visibleSections = $derived(
		shortcutSections
			.map((section) => ({
				...section,
				shortcuts: section.shortcuts.filter(
					(shortcut) => !shortcut.onlyFor || shortcut.onlyFor === effectiveRole
				)
			}))
			.filter((section) => section.shortcuts.length > 0)
	);
</script>

<Dialog.Root bind:open>
	<Dialog.Trigger>
		<Button
			variant="ghost"
			size="icon"
			aria-label="Keyboard shortcuts"
			class="opacity-75 backdrop-blur-md backdrop-opacity-50 hover:opacity-100"
		>
			<Keyboard class="h-4 w-4 text-shadow-lg" />
		</Button>
	</Dialog.Trigger>
	<Dialog.Content class="max-h-[80vh] max-w-2xl overflow-y-auto">
		<Dialog.Header>
			<Dialog.Title>Keyboard Shortcuts</Dialog.Title>
			<Dialog.Description>
				Quick reference for keyboard shortcuts available in the map view.
			</Dialog.Description>
		</Dialog.Header>

		<div class="my-2 space-y-6">
			{#each visibleSections as section (section.title)}
				<div class="space-y-3">
					<h3 class="text-sm font-semibold text-foreground">{section.title}</h3>
					<div class="space-y-2">
						{#each section.shortcuts as shortcut (shortcut.description)}
							<div class="flex items-center justify-between gap-4">
								<span class="flex-1 text-sm text-muted-foreground">
									{shortcut.description}
								</span>
								<Kbd.Group>
									{#each shortcut.keys as key (shortcut.description + key)}
										<Kbd.Kbd>{key}</Kbd.Kbd>
									{/each}
								</Kbd.Group>
							</div>
						{/each}
					</div>
				</div>
			{/each}
		</div>

		<Dialog.Footer>
			<Dialog.Close>
				<Button variant="outline">Close</Button>
			</Dialog.Close>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
