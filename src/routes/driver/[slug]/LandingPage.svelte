<script lang="ts">
  import { _ } from 'svelte-i18n';

  interface Props {
    onCallToAction: () => void;
  }

  let { onCallToAction }: Props = $props();
</script>

<div class="prose container mx-auto px-5 text-neutral max-w-prose mt-4 prose-p:my-1">
  <h1 class="hero">
    {$_('driver.landing.how-much-of-your-ridehail-fare-goes-to-you')}
  </h1>
  <div class="flex justify-center">
    <button onclick={onCallToAction} class="btn btn-neutral mb-4">
      {$_('driver.landing.join-our-study')}
    </button>
  </div>
  <p>
    {$_('driver.landing.help-drivers-and-researchers-study-take-rates-and-study-fare-fairness')}
  </p>
  <ol class="prose-li:my-1">
    <li>
      {$_(
        'driver.landing.sign-a-consent-form-to-share-your-data-with-our-research-team-and-to-receive-notifications'
      )}
    </li>

    <li>{$_('driver.landing.link-your-uber-job-data-with-us-via-argyle')}</li>
  </ol>
  <p class="text-center">
    <a class="" href="/driver/instructions"> See detailed instructions in English </a>
  </p>
  <p class="text-center">
    <a class="" href="/driver/instrucciones"> Ver instrucciones detalladas en español </a>
  </p>
  <p class="text-center">
    <a class="" href="/driver/mode-demploi"> Voir instructions détaillées en français </a>
  </p>
</div>
