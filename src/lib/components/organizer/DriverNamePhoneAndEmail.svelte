<script lang="ts">
  import { formatPhoneNumber } from '@src/lib/utils';

  interface Props {
    fullName: string | null;
    phone: string | null;
    email: string | null;
    hasSynced: boolean;
  }

  let { fullName, phone, email, hasSynced }: Props = $props();
</script>

<div class="flex items-start gap-2.5">
  <svg
    xmlns="http://www.w3.org/2000/svg"
    class="w-7 h-7 shrink-0 text-base-content/30 mt-0.5"
    viewBox="0 0 24 24"
    stroke-width="1.5"
    stroke="currentColor"
    fill="none"
    stroke-linecap="round"
    stroke-linejoin="round"
  >
    <path stroke="none" d="M0 0h24v24H0z" fill="none" />
    <path d="M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0 -18 0" />
    <path d="M12 10m-3 0a3 3 0 1 0 6 0a3 3 0 1 0 -6 0" />
    <path d="M6.168 18.849a4 4 0 0 1 3.832 -2.849h4a4 4 0 0 1 3.834 2.855" />
  </svg>
  <div class="min-w-0">
    <p class="font-semibold text-sm text-base-content flex items-center gap-1.5">
      <span class="truncate">{fullName}</span>
      {#if hasSynced}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="15"
          height="15"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2.75"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="text-green-600 shrink-0"
          role="img"
        >
          <title>Data Synced</title>
          <path stroke="none" d="M0 0h24v24H0z" fill="none" />
          <path d="M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0 -18 0" />
          <path d="M9 12l2 2l4 -4" />
        </svg>
        <span class="uppercase text-xs font-bold text-green-600"> Data Synced </span>
      {/if}
    </p>
    {#if !phone}
      <p class="text-xs text-base-content/50">Phone number not available</p>
    {:else}
      <p class="text-xs text-base-content/50">{formatPhoneNumber(phone)}</p>
      {#if email}
        <p class="text-xs text-base-content/40">{email}</p>
      {/if}
    {/if}
  </div>
</div>
