<script lang="ts">
  import { _ } from 'svelte-i18n';
  import LanguageSelector from './LanguageSelector.svelte';
  import { PUB_SUPPORT_EMAIL } from '$env/static/public';
</script>

<footer
  class="w-full bg-primary mt-8 pt-24 pb-4 px-2 lg:px-8 flex flex-col items-center justify-center lg:flex-row lg:justify-between lg:items-end"
>
  <img src="/img/organization-logotype.svg" alt="The Sample Organization Logo." class="px-2 mb-8" />
  <div class="mt-4 flex gap-2 flex-col items-center lg:items-end">
    <a class="link" href="mailto:{PUB_SUPPORT_EMAIL}">{PUB_SUPPORT_EMAIL}</a>
    <LanguageSelector />
  </div>
</footer>
