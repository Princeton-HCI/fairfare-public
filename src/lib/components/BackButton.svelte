<script lang="ts">
  import ArrowLeft from '../icons/ArrowLeft.svelte';

  interface Props {
    href: string;
    moreClasses?: string;
  }

  let { href, moreClasses }: Props = $props();
</script>

<a class="btn btn-ghost pl-0 {moreClasses}" {href}>
  <ArrowLeft />
  Back
</a>
