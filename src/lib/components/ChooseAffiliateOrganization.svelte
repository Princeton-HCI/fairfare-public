<script lang="ts">
  import { goto } from '$app/navigation';
  import BottomDrawer from '@src/lib/components/BottomDrawer.svelte';
  import ExternalLink from '@src/lib/components/ExternalLink.svelte';
  import { affiliations, allAffiliations, loadAllAffiliations } from '@src/lib/stores/affiliations';
  import { _ } from 'svelte-i18n';
  import Spinner from '@src/lib/components/Spinner.svelte';

  interface Props {
    showButton?: boolean;
    preloadSelectedAffiliations?: boolean;
  }

  let { showButton = true, preloadSelectedAffiliations = false }: Props = $props();
  let isLoading = $state(false);

  let selectedAffiliation = $derived($affiliations.selected);
  let affiliationsLoaded = $derived($affiliations.selectedAffiliationsAreLoadedFromDatabase);

  const continueUrl = $derived(
    selectedAffiliation?.key
      ? `/driver/org-data-sharing/${selectedAffiliation.key}`
      : '/driver/org-data-sharing'
  );

  const handleContinue = (event: MouseEvent) => {
    event.preventDefault();
    isLoading = true;
    goto(continueUrl);
  };

  // Load all available organizations from the database
  loadAllAffiliations();

  if (preloadSelectedAffiliations) {
    affiliations.getSelectedAffiliationsFromDatabase();
  }
</script>

{#if preloadSelectedAffiliations && !affiliationsLoaded}
  <div class="flex flex-col items-center justify-center w-full h-[512px]">
    <div class="loader"></div>
  </div>
{:else}
  <form>
    <div class="w-full prose">
      <h1>
        {$_('driver.org.your-affiliation')}
      </h1>
      <div class="space-y-2 mx-auto flex flex-col">
        <fieldset>
          <legend>
            {$_('driver.org.are-you-a-part-of-any-driver-orgs')}
          </legend>

          {#each $allAffiliations as affiliation}
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
                {affiliation.name}
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
          <a
            href={continueUrl}
            class="btn btn-neutral w-full"
            class:btn-disabled={isLoading}
            data-sveltekit-preload-data="hover"
            data-sveltekit-preload-code="eager"
            onclick={handleContinue}
          >
            {#if isLoading}
              <Spinner />
            {:else}
              {$_('driver.org.continue')}
            {/if}
          </a>
        </BottomDrawer>
      {/if}
    </div>
  </form>
{/if}
