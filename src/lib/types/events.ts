import type { UserRole } from './database';

export type EventRole = UserRole | 'all';

/**
 * Every event name carried on the campaign bus.
 *
 * Server emitters and client listeners both derive from this list, so an event that is
 * emitted but never handled (or handled but never emitted) fails to compile instead of
 * silently doing nothing.
 */
export const CAMPAIGN_EVENTS = [
  'tile:revealed',
  'tile:hidden',
  'tiles-always-revealed-updated',
  'marker:created',
  'marker:updated',
  'marker:deleted',
  'session:started',
  'session:ended',
  'session:deleted',
  'movement:step-added',
  'time:updated',
] as const;

export type CampaignEvent = (typeof CAMPAIGN_EVENTS)[number];
