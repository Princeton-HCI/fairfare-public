import { writable } from 'svelte/store';

type Toast = {
  text: string;
  type: 'error' | 'success' | 'info';
};

export const toasts = writable<Toast[]>([]);

export function toast(t: Toast) {
  toasts.update((state) => [t, ...state]);
  console.log('adding toast:', t);
  if (t.type === 'error') {
    setTimeout(removeToast, 10_000);
  } else {
    setTimeout(removeToast, 3000);
  }
}

function removeToast() {
  toasts.update((state) => {
    return [...state.slice(0, state.length - 1)];
  });
}
