export type UIToolGeneric = 'interact' | 'pan';
export type UIToolPlayer = 'explore';
export type UIToolDM = 'select' | 'paint' | 'set-position';
export type UITool = UIToolGeneric | UIToolDM | UIToolPlayer;
export type SelectMode = 'add' | 'remove';

export type MarkerType =
  | 'settlement' // Cities, towns, villages
  | 'dungeon' // Dungeons, caves, lairs
  | 'ruins' // Ruins, abandoned structures
  | 'rest' // Camps, inns, safe havens
  | 'landmark' // Notable locations, features
  | 'danger' // Hazards, threats
  | 'warning' // Caution areas
  | 'generic' // General marker
  | 'custom'; // Custom uploaded icon

export interface DialogAction {
  label: string;
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
  action: () => void;
}

export interface DialogConfig {
  title: string;
  description: string;
  actions: DialogAction[];
}
