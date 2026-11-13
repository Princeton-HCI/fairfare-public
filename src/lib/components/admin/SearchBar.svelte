<script lang="ts">
  /**
   * URL-driven search box. Submits as a GET form so the query lands in the URL
   * (deep-linkable, back-button-safe) and the page's `load` re-runs server-side.
   * Hidden inputs preserve any sibling query params (e.g. status filter).
   */
  interface Props {
    value?: string;
    placeholder?: string;
    /** Other query params to preserve on submit, e.g. { status: 'active' }. */
    preserve?: Record<string, string>;
  }

  let { value = '', placeholder = 'Search…', preserve = {} }: Props = $props();
</script>

<form method="GET" class="flex items-center gap-2" role="search">
  {#each Object.entries(preserve) as [key, val]}
    <input type="hidden" name={key} value={val} />
  {/each}
  <input
    type="search"
    name="q"
    {value}
    {placeholder}
    aria-label={placeholder}
    class="input input-bordered input-sm w-64 max-w-full"
  />
  <button type="submit" class="btn btn-sm btn-neutral">Search</button>
</form>
