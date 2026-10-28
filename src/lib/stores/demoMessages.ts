import { writable } from 'svelte/store';
import type { DemoMessage } from '$lib/demo/messages';

// Re-export the type so existing imports don't break
export type { DemoMessage };

function createDemoMessagesStore() {
  const { set, subscribe, update } = writable<DemoMessage[]>([]);

  return {
    subscribe,
    set,
    clear: () => set([]),
    addMessages: (messages: DemoMessage[]) => {
      update((current) => [...current, ...messages]);
    }
  };
}

export const demoMessages = createDemoMessagesStore();
