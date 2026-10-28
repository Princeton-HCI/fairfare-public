<script lang="ts">
  import type { Snippet } from 'svelte';
  import Modal from './Modal.svelte';

  interface Props {
    id: string;
    title: string;
    message?: string;
    messageContent?: Snippet;
    confirmLabel?: string;
    cancelLabel?: string;
    destructive?: boolean;
    onConfirm: () => void | Promise<void>;
    trigger: Snippet;
    buttonClass?: string;
    buttonDisabled?: boolean;
  }

  let {
    id,
    title,
    message,
    messageContent,
    confirmLabel = 'Confirm',
    cancelLabel = 'Cancel',
    destructive = false,
    onConfirm,
    trigger,
    buttonClass,
    buttonDisabled
  }: Props = $props();

  let modal: { closeModal: () => void };
  let isConfirming = $state(false);

  const handleConfirm = async () => {
    if (isConfirming) return;
    isConfirming = true;
    try {
      await onConfirm();
      modal.closeModal();
    } finally {
      isConfirming = false;
    }
  };
</script>

<Modal {id} {title} {buttonClass} {buttonDisabled} bind:this={modal}>
  {#snippet buttonContent()}
    {@render trigger()}
  {/snippet}
  {#snippet dialogContent()}
    <div class="mt-2">
      {#if messageContent}
        {@render messageContent()}
      {:else if message}
        <p class="text-base-content/70 text-center">{message}</p>
      {/if}
      <div class="mt-6 flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
        <button
          type="button"
          class="btn btn-ghost"
          onclick={() => modal.closeModal()}
          disabled={isConfirming}
        >
          {cancelLabel}
        </button>
        <button
          type="button"
          class="btn {destructive ? 'btn-error' : 'btn-primary'}"
          onclick={handleConfirm}
          disabled={isConfirming}
        >
          {isConfirming ? `${confirmLabel}…` : confirmLabel}
        </button>
      </div>
    </div>
  {/snippet}
</Modal>
