import { PersistedState } from 'runed';

export interface SessionSettings {
	// Exploration settings
	promptBeforeMovement: boolean;
	// Future settings can be added here
	// showPathHistory: boolean;
	// autoSaveInterval: number;
}

const defaultSettings: SessionSettings = {
	promptBeforeMovement: true
};

export const sessionSettings = new PersistedState<SessionSettings>(
	'chult-session-settings',
	defaultSettings
);
