<script lang="ts">
  /**
   * Status pill that always pairs color with a text label so meaning is never
   * conveyed by color alone (accessibility: color-not-only).
   */
  interface Props {
    status: string | null | undefined;
  }

  let { status }: Props = $props();

  const map: Record<string, { cls: string; label: string }> = {
    active: { cls: 'badge-success', label: 'Active' },
    deleted: { cls: 'badge-error', label: 'Deleted' },
    synced: { cls: 'badge-success', label: 'Synced' },
    pending: { cls: 'badge-warning', label: 'Pending' },
    error: { cls: 'badge-error', label: 'Error' },
    never: { cls: 'badge-ghost', label: 'Never synced' }
  };

  const entry = $derived(
    status && map[status] ? map[status] : { cls: 'badge-ghost', label: status ?? 'Unknown' }
  );
</script>

<span class="badge badge-sm {entry.cls} gap-1 whitespace-nowrap">{entry.label}</span>
