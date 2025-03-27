<script lang="ts">
  interface Props {
    href: string;
    moreClasses?: string | undefined;
    size?: 'xs' | 'base';
    children: import('svelte').Snippet;
  }

  let { href, moreClasses = '', size = 'xs', children }: Props = $props();
</script>

<a
  {href}
  target="_blank"
  class="link inline-flex items-center gap-1 {moreClasses} {size === 'xs' && 'text-xs'}"
  rel="noopener noreferrer"
>
  {@render children()}
  <!-- FIXME: move to icons directory -->
  <!-- https://tabler.io/icons/icon/external-link -->
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={12}
    height={12}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width={1.75}
    stroke-linecap="round"
    stroke-linejoin="round"
    class="icon icon-tabler icons-tabler-outline icon-tabler-external-link"
  >
    <path stroke="none" d="M0 0h24v24H0z" fill="none" />
    <path d="M12 6h-6a2 2 0 0 0 -2 2v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2 -2v-6" />
    <path d="M11 13l9 -9" />
    <path d="M15 4h5v5" />
  </svg>
</a>
