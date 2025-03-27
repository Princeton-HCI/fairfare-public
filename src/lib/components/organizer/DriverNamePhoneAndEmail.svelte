<script lang="ts">
  import { formatPhoneNumber } from '@src/lib/utils';

  interface Props {
    fullName: string | null;
    phone: string | null; // like 12223334444
    email: string | null; // like 12223334444
    hasSynced: boolean;
  }

  let { fullName, phone, email, hasSynced }: Props = $props();
</script>

<div class="flex justify-start gap-2 max-w-md">
  <!-- FIXME: move to icons directory -->
  <svg
    xmlns="http://www.w3.org/2000/svg"
    class="icon icon-tabler icon-tabler-user-circle pt-1"
    width="44"
    height="44"
    viewBox="0 0 24 24"
    stroke-width="1.5"
    stroke="#2c3e50"
    fill="none"
    stroke-linecap="round"
    stroke-linejoin="round"
  >
    <path stroke="none" d="M0 0h24v24H0z" fill="none" />
    <path d="M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0 -18 0" />
    <path d="M12 10m-3 0a3 3 0 1 0 6 0a3 3 0 1 0 -6 0" />
    <path d="M6.168 18.849a4 4 0 0 1 3.832 -2.849h4a4 4 0 0 1 3.834 2.855" />
  </svg>
  <div class="flex flex-col gap-0.5">
    <p class="font-bold flex align-middle gap-1">
      <span>{fullName}</span>
      {#if hasSynced}
        <!-- FIXME: move to icons directory -->
        <!-- https://tabler.io/icons/icon/circle-check -->
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2.75"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="icon icon-tabler icons-tabler-outline icon-tabler-circle-check text-green-600 mt-1 ml-1"
          role="img"
        >
          <title>Data Synced</title>
          <path stroke="none" d="M0 0h24v24H0z" fill="none" />
          <path d="M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0 -18 0" />
          <path d="M9 12l2 2l4 -4" />
        </svg>
        <span class="uppercase text-sm font-bold mt-1.5 leading-none text-green-600">
          Data Synced
        </span>
      {/if}
    </p>
    {#if !phone}
      <p>Phone number not available</p>
    {:else}
      <p>{formatPhoneNumber(phone)}</p>
      <p>{email}</p>
    {/if}
  </div>
</div>
