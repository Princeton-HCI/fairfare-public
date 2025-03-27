import { get, writable } from 'svelte/store';

export interface ArgyleAccounts {
  userId?: string;
  token?: string;
  argyleAccounts: {
    accountId: string;
  }[];
}

function createArgyleAccount() {
  const { subscribe, set, update } = writable<ArgyleAccounts>({ argyleAccounts: [] });

  return {
    subscribe,
    get: () => get(argyleAccounts),
    set: (data: ArgyleAccounts) => set(data),
    getArgyleAccountsLength: () => get(argyleAccounts).argyleAccounts.length,
    setToken: (token: string) => set({ ...get(argyleAccounts), token }),
    setFromArgyleLinkData: (data: { accountId: string; userId: string; itemId: string }) =>
      update((state) => ({
        ...state,
        userId: data.userId,
        argyleAccounts: [...state.argyleAccounts, { accountId: data.accountId }]
      })),
    addArgyleAccount: (accountId: string) =>
      update((state) => ({ ...state, argyleAccounts: [...state.argyleAccounts, { accountId }] })),
    setUserId: (userId: string) => set({ ...get(argyleAccounts), userId })
  };
}

export const argyleAccounts = createArgyleAccount();
