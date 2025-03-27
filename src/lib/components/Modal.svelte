<script lang="ts">
  import { onMount } from 'svelte';
  import MicroModal from 'micromodal';
  import X from '../icons/X.svelte';

  interface Props {
    id: string;
    title: string;
    onClose?: () => void;
    onOpen?: () => void;
    dialogContent: import('svelte').Snippet;
    buttonContent: import('svelte').Snippet;
    buttonClass?: string;
    modalClass?: string;
    buttonDisabled?: boolean;
  }

  let {
    id,
    title,
    onClose,
    onOpen,
    dialogContent,
    buttonContent,
    buttonDisabled,
    buttonClass,
    modalClass
  }: Props = $props();

  // allow the parent to close the modal as needed
  export function closeModal() {
    if (onClose) onClose();
    MicroModal.close(id);
  }

  const closeLabel = 'Close modal';

  onMount(() => {
    MicroModal.init();
  });
</script>

<button
  data-micromodal-trigger={id}
  onclick={() => {
    if (onOpen) onOpen();
  }}
  disabled={buttonDisabled}
  class={buttonClass}
>
  {@render buttonContent()}
</button>

<div class="hidden mm-modal" {id} aria-hidden="true">
  <div data-micromodal-close tabindex="-1" class="fixed inset-0 bg-black bg-opacity-50"></div>
  <div
    role="dialog"
    aria-modal="true"
    aria-labelledby={`${id}-title`}
    class="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-base-100 p-6 w-[95vw] max-w-[580px] rounded-sm max-h-screen overflow-y-auto {modalClass}"
  >
    <header class="flex flex-col justify-between items-center mb-2">
      <button
        data-micromodal-close
        class="cursor-pointer flex text-current bg-transparent border-0 p-0 self-end"
      >
        <X />
        <span class="sr-only">{closeLabel}</span>
      </button>
      <h2 id={`${id}-title`} class="text-2xl font-medium m-0 text-center">
        {title}
      </h2>
    </header>
    {@render dialogContent()}
  </div>
</div>

<style>
  .mm-modal {
    display: none;
  }

  /* is-open is set by micromodal and shouldn't be purged */
  .mm-modal:global(.is-open) {
    display: block;
  }
</style>
