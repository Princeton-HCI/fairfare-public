<script lang="ts">
  import short from 'short-uuid';
  import { _ } from 'svelte-i18n';

  import { browser, dev } from '$app/environment';
  import { page } from '$app/state';

  import { title } from '@src/lib/stores/pageinfo';

  title.set('Done');

  const translator = short();
  let shortUUID = $derived(page.data.user && translator.fromUUID(page.data.user.id));
  let surveyLink = $derived(browser ? `${window.origin}/driver/data/${shortUUID}` : '');
</script>

<div class="prose">
  <h1>
    {$_('driver.done.youre-done')}
  </h1>
  <img
    src="/img/thank-you-for-sharing-your-data.webp"
    alt="A person and a dog driving quickly in a car."
    class="w-1/2 mx-auto max-w-[250px]"
  />
  <p>{$_('driver.done.syncing-your-data-can-take-up-to-a-few-hours')}</p>
  {#if dev}
    <!-- skipping i18n here for dev only -->
    <div class="flex flex-col items-center w-full">
      <a href={surveyLink} class="btn btn-primary"> Open driver data</a>
      <p class="text-xs">(Visible only in development)</p>
    </div>
  {/if}
</div>
