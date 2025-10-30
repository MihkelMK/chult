import type { MarkerType } from '$lib/types';

// Marker type constants (application-side validation)
export const MARKER_TYPES = [
	'settlement', // Cities, towns, villages
	'dungeon', // Dungeons, caves, lairs
	'ruins', // Ruins, abandoned structures
	'rest', // Camps, inns, safe havens
	'landmark', // Notable locations, features
	'danger', // Hazards, threats
	'warning', // Caution areas
	'generic', // General marker
	'custom' // Custom uploaded icon
] satisfies MarkerType[];
