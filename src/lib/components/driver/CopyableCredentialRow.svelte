<script lang="ts">
  import { toast } from '@src/lib/toasts';

  interface Props {
    label: string;
    value: string;
    /** 'primary' has larger text, 'secondary' has smaller text */
    size?: 'primary' | 'secondary';
    /** 'sidebar' for desktop sidebar, 'mobile' for mobile bottom sheet */
    variant?: 'sidebar' | 'mobile';
  }

  let { label, value, size = 'secondary', variant = 'sidebar' }: Props = $props();

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(value);
      toast({ text: `${label} copied!`, type: 'success' });
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const isPrimary = $derived(size === 'primary');
  const isMobile = $derived(variant === 'mobile');
</script>

{#if isMobile}
  <!-- Mobile variant: vertical label/value with "Copy" text -->
  <button
    class="flex items-center justify-between w-full px-4 hover:bg-gray-50 active:bg-gray-100 rounded-lg transition-colors {isPrimary
      ? 'py-3'
      : 'py-2.5'}"
    onclick={copyToClipboard}
  >
    <div class="flex flex-col items-start">
      <span class="text-xs text-gray-500">{label}</span>
      <span
        class={isPrimary
          ? 'text-base font-semibold text-gray-900'
          : 'text-sm font-medium text-gray-900'}>{value}</span
      >
    </div>
    <div class="flex items-center gap-2 text-amber-600">
      <span class="text-xs font-medium">Copy</span>
      <svg
        class={isPrimary ? 'w-4 h-4' : 'w-3.5 h-3.5'}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
      >
        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
      </svg>
    </div>
  </button>
{:else}
  <!-- Sidebar variant: horizontal label/value with icon only -->
  <button
    class="flex items-center justify-between w-full px-5 hover:bg-black/[0.03] transition-colors group {isPrimary
      ? 'py-2.5'
      : 'py-2'}"
    onclick={copyToClipboard}
  >
    <div class="flex items-center justify-between flex-1 mr-3">
      <span class={isPrimary ? 'text-sm text-gray-500' : 'text-[13px] text-gray-500'}>{label}</span>
      <span
        class={isPrimary
          ? 'text-base font-semibold text-gray-900'
          : 'text-sm font-medium text-gray-900'}>{value}</span
      >
    </div>
    <svg
      class="{isPrimary
        ? 'w-4 h-4'
        : 'w-3.5 h-3.5'} text-gray-400 opacity-50 group-hover:opacity-100 transition-opacity flex-shrink-0"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
    >
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
    </svg>
  </button>
{/if}
