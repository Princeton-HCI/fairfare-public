<script lang="ts">
  import { fly } from 'svelte/transition';
  import { toasts } from '@src/lib/toasts';

  import ExclamationCircleFilled from '@src/lib/icons/ExclamationCircleFilled.svelte';
</script>

<div>
  {#if $toasts.length > 0}
    <!-- This z-index ensures the toasts sit on top of the Argyle interface -->
    <dialog
      class="fixed left-0 top-20 z-[9999999999] flex flex-col items-center gap-4 w-full px-4 bg-transparent max-w-lg"
    >
      {#each $toasts as toast}
        <!--
          Note that for info we don't use alert-info, but rather just keep
          the default alert class with no override.
        -->
        <div
          role="alert"
          class="leading-none flex min-h-12 items-center w-full shadow-lg {toast.type === 'error' &&
            'bg-error text-error-content'} {toast.type === 'success' &&
            'bg-success text-success-content'} {toast.type === 'info' &&
            'bg-base-200 text-content'}"
          transition:fly={{ y: -100, duration: 200 }}
        >
          <div
            class="bg-[#ffffff33] min-h-12 h-full grow w-12 max-w-12 flex items-center justify-center"
          >
            <ExclamationCircleFilled />
          </div>
          <span class="p-2 grow">{toast.text}</span>
        </div>
      {/each}
    </dialog>
  {/if}
</div>
