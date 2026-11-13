import { writable } from 'svelte/store';
import { demoMessages } from './demoMessages';
import { generateDemoMessages } from '$lib/demo/messages';

function createUserDemoPhoneNumberStore() {
  const { set, subscribe } = writable('');

  return {
    set: (value: string) => {
      set(value);
    },
    subscribe,
    /**
     * Generate and display demo SMS messages.
     * This is now synchronous and client-side only - no server round-trip needed.
     */
    sendDemoSMSMessages: () => {
      const messages = generateDemoMessages();
      demoMessages.set(messages);
      return messages;
    }
  };
}

export const userDemoPhoneNumber = createUserDemoPhoneNumberStore();
