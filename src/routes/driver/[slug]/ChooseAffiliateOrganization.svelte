<script lang="ts">
  import { enhance } from '$app/forms';
  import { goto } from '$app/navigation';
  import BottomDrawer from '@src/lib/components/BottomDrawer.svelte';
  import ExternalLink from '@src/lib/components/ExternalLink.svelte';
  import { affiliations, allAffiliations } from '@src/lib/stores/affiliations';
  import { _ } from 'svelte-i18n';

  interface Props {
    showButton?: boolean;
    preloadSelectedAffiliations?: boolean;
  }

  let { showButton = true, preloadSelectedAffiliations = false }: Props = $props();

  let selectedAffiliation = $derived($affiliations.selected);
  let affiliationsLoaded = $derived($affiliations.selectedAffiliationsAreLoadedFromDatabase);

  if (preloadSelectedAffiliations) {
    affiliations.getSelectedAffiliationsFromDatabase();
  }
</script>

{#if preloadSelectedAffiliations && !affiliationsLoaded}
  <div class="flex flex-col items-center justify-center w-full h-[512px]">
    <div class="loader"></div>
  </div>
{:else}
  <form
    method="POST"
    use:enhance={({ cancel }) => {
      cancel();
      goto('/driver/org-data-sharing');
    }}
  >
    <div class="w-full prose">
      <h1>
        {$_('driver.org.your-affiliation')}
      </h1>
      <div class="max-w-sm space-y-2 mx-auto flex flex-col">
        <fieldset>
          <legend>
            {$_('driver.org.are-you-a-part-of-any-driver-orgs')}
          </legend>

          {#each allAffiliations as affiliation}
            <div class="mt-3">
              <!-- FIXME: make the input checked value actually propagate -->
              <input
                class="opacity-0 w-0 h-0 overflow-hidden block"
                type="radio"
                id={affiliation.key}
                name="affiliation"
                value={affiliation.key}
                onchange={() => affiliations.toggleSelection(affiliation)}
                checked={selectedAffiliation?.key === affiliation.key}
              />
              <label
                for={affiliation.key}
                class={`grow rounded-full btn w-full normal-case ${
                  selectedAffiliation?.key === affiliation.key ? 'btn-neutral' : 'btn-outline'
                }`}
              >
                {$_(`driver.org.affiliations.${affiliation.key}`)}
              </label>
            </div>
            {#if affiliation.url}
              <p class="m-0">
                <ExternalLink href={affiliation.url}>Learn more</ExternalLink>
              </p>
            {/if}
          {/each}
        </fieldset>
      </div>

      <input type="hidden" name="orgId" value={selectedAffiliation} />

      {#if showButton}
        <BottomDrawer>
          <button class="btn btn-neutral w-full">{$_('driver.org.continue')}</button>
        </BottomDrawer>
      {/if}
    </div>
  </form>
{/if}
