import { writable } from 'svelte/store';

function createTitle() {
  const { subscribe, set } = writable('');

  return {
    subscribe,
    set: (value: string) => {
      set(`${value} • System`);
    },
    clear: () => {
      set('System • Home');
    }
  };
}

export const title = createTitle();
