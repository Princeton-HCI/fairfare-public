<script lang="ts">
  import { _ } from 'svelte-i18n';
  import type { DemoMessage } from '@src/lib/stores/demoMessages';

  interface Props {
    messages: DemoMessage[];
    onClose?: () => void;
  }

  let { messages, onClose }: Props = $props();

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };
</script>

<div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
  <div class="bg-base-100 rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden">
    <!-- Phone header -->
    <div class="bg-base-300 px-4 py-3 flex items-center justify-between">
      <div class="flex items-center gap-2">
        <div class="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
          <span class="text-primary-content text-sm font-bold">FF</span>
        </div>
        <div>
          <p class="font-semibold text-sm">System</p>
          <p class="text-xs opacity-70">{$_('demo.sms_preview.demo_messages')}</p>
        </div>
      </div>
      {#if onClose}
        <button
          class="btn btn-ghost btn-sm btn-circle"
          onclick={onClose}
          aria-label="Close preview"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      {/if}
    </div>

    <!-- Messages container -->
    <div class="p-4 space-y-3 max-h-96 overflow-y-auto bg-base-200">
      {#if messages.length === 0}
        <p class="text-center text-sm opacity-70">{$_('demo.sms_preview.no_messages')}</p>
      {:else}
        {#each messages as message}
          <div class="chat chat-start">
            <div class="chat-bubble chat-bubble-primary">
              <p class="text-sm">{message.text}</p>
            </div>
            <div class="chat-footer opacity-50 text-xs mt-1">
              {formatTime(message.timestamp)}
            </div>
          </div>
        {/each}
      {/if}
    </div>

    <!-- Footer with info -->
    <div class="bg-base-300 px-4 py-3 border-t border-base-content/10">
      <div class="flex items-center gap-2 text-sm opacity-70">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          class="h-4 w-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        <span>{$_('demo.sms_preview.demo_mode_notice')}</span>
      </div>
    </div>

    <!-- Close button -->
    {#if onClose}
      <div class="p-4 bg-base-100">
        <button class="btn btn-primary w-full" onclick={onClose}>
          {$_('demo.sms_preview.continue')}
        </button>
      </div>
    {/if}
  </div>
</div>
