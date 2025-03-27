<script lang="ts">
  import { _ } from 'svelte-i18n';
  import LanguageSelector from './LanguageSelector.svelte';
</script>

<footer
  class="w-full bg-primary mt-8 pt-24 pb-4 px-2 lg:px-8 flex flex-col items-center justify-center lg:flex-row lg:justify-between lg:items-end"
>
  <img src="/img/organization-logotype.svg" alt="The organization Logo." class="px-2 mb-8" />
  <div class="mt-4 flex gap-2 flex-col items-center lg:items-end">
    <a class="link" href="mailto:theorganization@university.edu">theorganization@university.edu</a>
    <LanguageSelector />
  </div>
</footer>
