<script lang="ts">
  import { _, locale } from 'svelte-i18n';
  import { exportRefreshTrigger } from '@src/lib/stores/exportNotifications';

  interface Props {
    iconOnly?: boolean;
  }

  let { iconOnly = false }: Props = $props();

  type ExportRecord = {
    id: string;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    total_rows: number;
    filters: {
      startDate?: string;
      endDate?: string;
      startLocation?: string;
      endLocation?: string;
      locationCombiner?: string;
      platforms?: string[];
    };
    created_at: string;
    completed_at: string | null;
    error_message: string | null;
    read_at: string | null;
  };

  let exports = $state<ExportRecord[]>([]);
  let open = $state(false);

  let hasActiveExport = $derived(
    exports.some((e) => e.status === 'pending' || e.status === 'processing')
  );

  let unreadCount = $derived(
    exports.filter((e) => (e.status === 'completed' || e.status === 'failed') && e.read_at === null)
      .length
  );

  async function fetchExports() {
    try {
      const res = await fetch('/api/organizer/exports');
      if (!res.ok) return;
      const data = await res.json();
      exports = data.exports ?? [];
    } catch {
      // ignore
    }
  }

  async function cancelExport(id: string) {
    exports = exports.map((e) =>
      e.id === id ? { ...e, status: 'failed' as const, error_message: 'Cancelled by user' } : e
    );
    try {
      await fetch('/api/organizer/exports/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      });
    } catch {
      // Will re-sync on next poll
    }
    fetchExports();
  }

  async function markAllRead() {
    exports = exports.map((e) =>
      e.read_at === null && (e.status === 'completed' || e.status === 'failed')
        ? { ...e, read_at: new Date().toISOString() }
        : e
    );

    try {
      await fetch('/api/organizer/exports/mark-read', { method: 'PATCH' });
    } catch {
      // Badge will re-sync on next poll if the request failed
    }
  }

  $effect(() => {
    const unsubscribe = exportRefreshTrigger.subscribe(() => fetchExports());
    return unsubscribe;
  });

  $effect(() => {
    const interval = setInterval(fetchExports, hasActiveExport ? 3_000 : 30_000);
    return () => clearInterval(interval);
  });

  function toggle() {
    open = !open;
    if (open && unreadCount > 0) {
      markAllRead();
    }
  }

  function closeDropdown() {
    open = false;
  }

  function formatDate(iso: string): string {
    return new Date(iso).toLocaleString($locale ?? 'en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  }

  function handleClickOutside(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (!target.closest('.export-notifications-container')) {
      closeDropdown();
    }
  }
</script>

<svelte:window onclick={handleClickOutside} />

<div class="export-notifications-container relative">
  <button
    class="flex items-center gap-3 w-full py-2 rounded-lg text-sm font-medium text-base-content/60 hover:bg-base-200/50 hover:text-base-content transition-colors duration-200 cursor-pointer relative
      {iconOnly ? 'justify-center' : ''}"
    onclick={toggle}
    title={$_('organizer.exports.bell-tooltip')}
  >
    <span class="relative shrink-0">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        class="h-5 w-5"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        stroke-width="2"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
        />
      </svg>
      {#if iconOnly && (unreadCount > 0 || hasActiveExport)}
        <span
          class="absolute -top-1.5 -right-1.5 bg-primary text-primary-content rounded-full text-[10px] w-4 h-4 flex items-center justify-center font-semibold"
        >
          {#if hasActiveExport}<span class="animate-pulse">*</span>{:else}{unreadCount}{/if}
        </span>
      {/if}
    </span>
    {#if !iconOnly}
      <span>{$_('organizer.exports.title')}</span>
      {#if unreadCount > 0 || hasActiveExport}
        <span
          class="ml-auto bg-primary text-primary-content rounded-full text-xs w-5 h-5 flex items-center justify-center font-semibold"
        >
          {#if hasActiveExport}
            <span class="animate-pulse">*</span>
          {:else}
            {unreadCount}
          {/if}
        </span>
      {/if}
    {/if}
  </button>

  {#if open}
    <div
      class="absolute left-full bottom-0 ml-2 w-80 bg-base-100 border border-base-300 rounded-xl shadow-xl z-[9999] max-h-96 overflow-y-auto"
    >
      <div class="px-4 py-3 border-b border-base-300 sticky top-0 bg-base-100 rounded-t-xl">
        <h3 class="font-semibold text-sm text-base-content">{$_('organizer.exports.title')}</h3>
      </div>

      {#if exports.length === 0}
        <div class="px-4 py-6 text-sm text-base-content/50 text-center">
          {$_('organizer.exports.empty')}
        </div>
      {:else}
        {#each exports as exp (exp.id)}
          <div
            class="px-4 py-3 border-b border-base-200 last:border-b-0 transition-colors hover:bg-base-200/40"
          >
            <div class="flex items-center justify-between gap-2">
              <span class="text-xs text-base-content/50">{formatDate(exp.created_at)}</span>
              {#if exp.status === 'completed'}
                <span class="badge badge-success badge-sm text-[11px] gap-1">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    class="h-3 w-3"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fill-rule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clip-rule="evenodd"
                    />
                  </svg>
                  {$_('organizer.exports.status.completed')}
                </span>
              {:else if exp.status === 'processing' || exp.status === 'pending'}
                <span class="badge badge-info badge-sm text-[11px] gap-1">
                  <span class="loading loading-spinner loading-xs"></span>
                  {$_('organizer.exports.status.processing')}
                </span>
              {:else if exp.status === 'failed'}
                <span class="badge badge-error badge-sm text-[11px]"
                  >{$_('organizer.exports.status.failed')}</span
                >
              {/if}
            </div>

            {#if exp.status === 'completed' || exp.total_rows > 0}
              <p class="text-sm mt-1 font-medium text-base-content">
                {exp.total_rows.toLocaleString()}
                {$_('organizer.exports.rows')}
              </p>
            {/if}

            {#if exp.filters?.startDate || exp.filters?.endDate}
              <p class="text-xs text-base-content/50 mt-0.5">
                {exp.filters.startDate ?? '...'} &ndash; {exp.filters.endDate ?? '...'}
                {#if exp.filters.startLocation}
                  &middot; start {exp.filters.startLocation}
                {/if}
                {#if exp.filters.endLocation}
                  &middot; end {exp.filters.endLocation}
                {/if}
                {#if exp.filters.platforms?.length}
                  &middot; {exp.filters.platforms.join(', ')}
                {/if}
              </p>
            {/if}

            <div class="mt-2">
              {#if exp.status === 'completed'}
                <a
                  href={`/api/organizer/download_export?id=${exp.id}`}
                  download
                  class="btn btn-xs btn-primary gap-1"
                  onclick={(e) => e.stopPropagation()}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    class="h-3.5 w-3.5"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fill-rule="evenodd"
                      d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z"
                      clip-rule="evenodd"
                    />
                  </svg>
                  {$_('organizer.exports.download')}
                </a>
              {:else if exp.status === 'pending' || exp.status === 'processing'}
                <button
                  class="btn btn-xs btn-outline btn-error gap-1"
                  onclick={(e) => {
                    e.stopPropagation();
                    cancelExport(exp.id);
                  }}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    class="h-3.5 w-3.5"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fill-rule="evenodd"
                      d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                      clip-rule="evenodd"
                    />
                  </svg>
                  {$_('organizer.exports.cancel')}
                </button>
              {:else if exp.status === 'failed' && exp.error_message}
                <p class="text-xs text-error">{exp.error_message}</p>
              {/if}
            </div>
          </div>
        {/each}
      {/if}
    </div>
  {/if}
</div>
