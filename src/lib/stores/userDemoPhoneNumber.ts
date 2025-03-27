import { toast } from '@src/lib/toasts';
import { writable, get } from 'svelte/store';

function createUserDemoPhoneNumberStore() {
  const { set, subscribe } = writable('');

  return {
    set: (value: string) => {
      set(value);
    },
    subscribe,
    sendDemoSMSMessages: async () => {
      const phoneNumber = get(userDemoPhoneNumber);
      try {
        const response = await fetch('/api/driver/send-demo-sms', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ phoneNumber })
        });
        if (!response.ok) {
          throw new Error('Failed to send SMS');
        }
      } catch (error) {
        console.error(error);
        toast({ text: 'Failed to send SMS', type: 'error' });
        throw error;
      }
    }
  };
}

export const userDemoPhoneNumber = createUserDemoPhoneNumberStore();
