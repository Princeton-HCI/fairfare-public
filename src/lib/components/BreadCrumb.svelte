<script lang="ts">
  interface Props {
    returnUrl?: string;
    text?: string;
  }

  let { returnUrl = encodeURIComponent(window.location.href), text = 'Go Back' }: Props = $props();
</script>

<p class="pb-4">
  <a href={returnUrl} class="self-start no-underline">{text}</a>
</p>
