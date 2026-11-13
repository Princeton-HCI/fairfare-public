<script lang="ts">
  import { page as pageState } from '$app/state';
  import { title } from '@src/lib/stores/pageinfo';
  import type { PageData } from './$types';
  import { formatDateTime, hrefWithParams } from '@src/lib/utils';

  let { data }: { data: PageData } = $props();
  title.set('Audit log');

  const sources = [
    { key: 'all', label: 'All' },
    { key: 'admin', label: 'Admin actions' },
    { key: 'organizer', label: 'Organizer activity' },
    { key: 'download', label: 'Data downloads' }
  ];

  /** Switching source restarts the feed: a cursor into the merged stream is
   *  meaningless once the stream it indexed into is filtered down. */
  const sourceHref = (key: string): string =>
    hrefWithParams(pageState.url, {
      source: key === 'all' ? null : key,
      before: null,
      after: null
    });

  const cursorHref = (param: 'before' | 'after', cursor: string | null): string =>
    hrefWithParams(pageState.url, {
      before: null,
      after: null,
      [param]: cursor
    });

  const latestHref = $derived(cursorHref('before', null));

  /** Shown whenever the feed is cursored, not just when a `newer` page exists,
   *  so a hand-edited cursor that lands past the head still has a way back. */
  const isCursored = $derived(
    pageState.url.searchParams.has('before') || pageState.url.searchParams.has('after')
  );

  const sourceBadge: Record<string, string> = {
    admin: 'badge-primary',
    organizer: 'badge-accent',
    download: 'badge-secondary'
  };

  function detailText(detail: unknown): string {
    if (detail == null) return '';
    try {
      return JSON.stringify(detail);
    } catch {
      return String(detail);
    }
  }
</script>

<div class="max-w-5xl">
  <h1 class="font-serif text-3xl font-bold text-base-content mb-1">Audit log</h1>
  <p class="text-base-content/60 mb-4">
    Admin actions, organizer activity, and driver-data downloads, newest first.
  </p>

  <div role="tablist" class="tabs tabs-boxed bg-base-200/50 mb-4 w-fit">
    {#each sources as s}
      <a
        role="tab"
        href={sourceHref(s.key)}
        class="tab {data.source === s.key ? 'tab-active' : ''}"
        aria-selected={data.source === s.key}>{s.label}</a
      >
    {/each}
  </div>

  <div class="overflow-x-auto rounded-lg border border-base-200 bg-white">
    <table class="table table-sm">
      <thead>
        <tr>
          <th>When</th>
          <th>Source</th>
          <th>Actor</th>
          <th>Action</th>
          <th>Target</th>
          <th>Detail</th>
        </tr>
      </thead>
      <tbody>
        {#each data.events as e (e.id)}
          <tr class="hover align-top">
            <td class="tabular-nums whitespace-nowrap">{formatDateTime(e.at)}</td>
            <td><span class="badge badge-sm {sourceBadge[e.source] ?? ''}">{e.source}</span></td>
            <td class="max-w-[14rem] truncate" title={e.actor}>{e.actor}</td>
            <td><code class="text-xs">{e.action}</code></td>
            <td class="max-w-[12rem] truncate" title={e.target}>{e.target || '—'}</td>
            <td
              class="max-w-[16rem] truncate text-base-content/60 text-xs"
              title={detailText(e.detail)}>{detailText(e.detail) || '—'}</td
            >
          </tr>
        {:else}
          <tr
            ><td colspan="6" class="text-center text-base-content/50 py-10">No audit events.</td
            ></tr
          >
        {/each}
      </tbody>
    </table>
  </div>

  <div class="flex items-center justify-between gap-4 mt-4 text-sm text-base-content/60">
    <span class="tabular-nums">
      {#if data.events.length === 0}
        No events
      {:else if data.total === null}
        <!-- The count failed while the rows read succeeded; showing "of 0" here
             would contradict the rows on screen. -->
        {data.events.length} events
      {:else}
        {data.events.length} of {data.total.toLocaleString()} events
      {/if}
      {#if isCursored}
        · <a class="link" href={latestHref}>Back to latest</a>
      {/if}
    </span>
    <div class="join">
      <a
        class="join-item btn btn-sm"
        class:btn-disabled={!data.newer}
        href={cursorHref('after', data.newer)}
        aria-label="Newer events"
        aria-disabled={!data.newer}>« Newer</a
      >
      <a
        class="join-item btn btn-sm"
        class:btn-disabled={!data.older}
        href={cursorHref('before', data.older)}
        aria-label="Older events"
        aria-disabled={!data.older}>Older »</a
      >
    </div>
  </div>
</div>
