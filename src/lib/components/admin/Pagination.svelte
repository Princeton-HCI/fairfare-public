<script lang="ts">
  import { page as pageState } from '$app/state';
  import { hrefWithParams } from '@src/lib/utils';

  interface Props {
    page: number;
    pageSize: number;
    total: number;
  }

  let { page, pageSize, total }: Props = $props();

  const totalPages = $derived(Math.max(1, Math.ceil(total / pageSize)));
  const from = $derived(total === 0 ? 0 : (page - 1) * pageSize + 1);
  const to = $derived(Math.min(page * pageSize, total));

  /** Build a URL for the given page, preserving all other current query params. */
  const pageHref = (targetPage: number): string =>
    hrefWithParams(pageState.url, { page: String(targetPage) });
</script>

<div class="flex items-center justify-between gap-4 mt-4 text-sm text-base-content/60">
  <span class="tabular-nums">
    {#if total === 0}
      No results
    {:else}
      Showing {from}–{to} of {total}
    {/if}
  </span>
  <div class="join">
    <a
      class="join-item btn btn-sm"
      class:btn-disabled={page <= 1}
      href={pageHref(page - 1)}
      aria-label="Previous page"
      aria-disabled={page <= 1}>«</a
    >
    <span class="join-item btn btn-sm btn-ghost no-animation pointer-events-none tabular-nums">
      Page {page} / {totalPages}
    </span>
    <a
      class="join-item btn btn-sm"
      class:btn-disabled={page >= totalPages}
      href={pageHref(page + 1)}
      aria-label="Next page"
      aria-disabled={page >= totalPages}>»</a
    >
  </div>
</div>
