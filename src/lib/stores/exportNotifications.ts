import { writable } from 'svelte/store';

/**
 * Incremented when a new export is requested.
 * The ExportNotificationsDropdown subscribes to this
 * and refreshes its list immediately on change.
 */
export const exportRefreshTrigger = writable(0);
