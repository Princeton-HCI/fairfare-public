<script lang="ts">
  import { ARGYLE_SANDBOX_BOB } from '$lib/demo/constants';
  import { _ } from 'svelte-i18n';
  import CopyableCredentialRow from './CopyableCredentialRow.svelte';

  let isExpanded = $state(false);

  const toggleExpand = () => {
    isExpanded = !isExpanded;
  };
</script>

<!-- Fixed floating container — bottom-center -->
<div class="fixed bottom-4 left-1/2 -translate-x-1/2 z-[2147483647] flex flex-col items-center">
  <!-- Expanded Credentials Panel (renders above the button) -->
  {#if isExpanded}
    <div class="w-72 font-sans mb-2 animate-fade-in">
      <!-- User Card Header -->
      <div
        class="flex items-center justify-between w-full px-4 py-3 bg-amber-50 border border-amber-200 rounded-t-xl"
      >
        <div class="flex flex-col items-start gap-1">
          <span class="text-sm font-semibold text-gray-900">{ARGYLE_SANDBOX_BOB.displayName}</span>
          <span
            class="inline-flex items-center justify-center px-2 py-0.5 text-[9px] font-bold text-amber-700 bg-amber-100 border border-amber-300 rounded tracking-wide"
          >
            {$_('demo.credentials.sample_user')}
          </span>
        </div>
        <img
          src={ARGYLE_SANDBOX_BOB.avatarUrl}
          alt={ARGYLE_SANDBOX_BOB.displayName}
          class="w-9 h-9 rounded-full border-2 border-amber-500 object-cover"
        />
      </div>

      <!-- Credentials Card -->
      <div class="bg-amber-50 border border-t-0 border-amber-200 rounded-b-xl pt-1.5">
        <!-- Primary credentials -->
        <CopyableCredentialRow label="Email" value={ARGYLE_SANDBOX_BOB.email} size="primary" />
        <CopyableCredentialRow
          label="Phone no."
          value={ARGYLE_SANDBOX_BOB.phoneFormatted}
          size="primary"
        />
        <div class="h-px bg-amber-200 mx-4 my-1.5"></div>

        <!-- Secondary credentials -->
        <CopyableCredentialRow
          label="Verification code"
          value={ARGYLE_SANDBOX_BOB.verificationCode}
        />
        <CopyableCredentialRow label="Driver's license" value={ARGYLE_SANDBOX_BOB.driversLicense} />

        <!-- Footer -->
        <div
          class="px-4 py-2.5 text-xs text-gray-500 text-left leading-snug border-t border-amber-200 mt-1.5"
        >
          {$_('demo.credentials.click_to_copy')}
        </div>
      </div>
    </div>
  {/if}

  <!-- Always-visible floating pill button (icon-only) -->
  <button
    onclick={toggleExpand}
    class="inline-flex flex-row items-center gap-2 h-12 bg-amber-500 text-white px-4 rounded-full shadow-lg hover:bg-amber-600 active:scale-95 transition-all cursor-pointer"
    aria-label={isExpanded ? 'Hide demo credentials' : 'Show demo credentials'}
  >
    <img
      src={ARGYLE_SANDBOX_BOB.avatarUrl}
      alt={ARGYLE_SANDBOX_BOB.displayName}
      class="w-7 h-7 flex-shrink-0 rounded-full border border-white object-cover"
    />
    <svg
      class="w-5 h-5 flex-shrink-0"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <path
        d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"
      />
    </svg>
  </button>
</div>

<style>
  @keyframes fade-in {
    from {
      opacity: 0;
      transform: translateY(4px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .animate-fade-in {
    animation: fade-in 0.2s ease-out;
  }
</style>
