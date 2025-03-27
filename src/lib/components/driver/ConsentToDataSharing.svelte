<script lang="ts">
  import { toast } from '@src/lib/toasts';
  import { affiliations, allAffiliations } from '@src/lib/stores/affiliations';
  import { dataSharingConsents } from '@src/lib/stores/dataSharingConsents';
  import { _ } from 'svelte-i18n';
  import DemoModePhoneIntake from '@src/lib/components/driver/DemoModePhoneIntake.svelte';
  import ExternalLink from '../ExternalLink.svelte';
  import BottomDrawer from '../BottomDrawer.svelte';
  import { goto } from '$app/navigation';
  import { isDemoMode } from '@src/lib/utils';

  interface Props {
    buttonText: string;
    onButtonClick?: () => void;
    preloadSelectedConsents?: boolean;
  }

  let {
    buttonText,
    onButtonClick = async () => {
      /**
       * By default, when users click this button we want to attempt to update
       * the data sharing consents and affiliations in the database.
       */
      try {
        await dataSharingConsents.updateDatabase();
        await affiliations.updateDatabase();
        goto('/driver/argyle');
      } catch (error) {
        console.log(error);
        toast({ text: $_('driver.settings.something-went-wrong-please-try-again'), type: 'error' });
        return;
      }
    },
    preloadSelectedConsents = false
  }: Props = $props();

  if (preloadSelectedConsents) {
    dataSharingConsents.getSelectedDataSharingConsentsFromDatabase();
  }

  dataSharingConsents.setAffiliateOrganizations(allAffiliations);

  let selectedAffiliation = $derived($affiliations.selected);
  let consentsToSelectedAffiliation = $derived(
    selectedAffiliation &&
      !!$dataSharingConsents.selected.find((dsc) => dsc.key === selectedAffiliation.key)
  );
  let shareDoNotShareIsTouched = $state(false);

  let canContinue = $derived(selectedAffiliation ? shareDoNotShareIsTouched : true);
  let doNotShareChecked = $derived(
    shareDoNotShareIsTouched ? consentsToSelectedAffiliation === false : false
  );
  let shareChecked = $derived(
    shareDoNotShareIsTouched ? consentsToSelectedAffiliation === true : false
  );
</script>

<div class="prose">
  <h1>
    {$_('driver.org.affiliations.sharing.can-we-share')}
  </h1>
  {#if selectedAffiliation?.key}
    <p class="text-sm">
      {$_('driver.org.affiliations.sharing.if-you-opt-in-the')} <strong>Organization</strong>
      {$_('driver.org.affiliations.sharing.will-share-data-with')}
      <strong>{$_(`driver.org.affiliations.${selectedAffiliation.key}`)}</strong>.
      {$_('driver.org.affiliations.sharing.after-data-is-shared')} <strong>Organization</strong>
      {$_('driver.org.affiliations.sharing.cannot-manage-or-delete')}
      <strong>{$_(`driver.org.affiliations.${selectedAffiliation.key}`)}</strong>
      {$_('driver.org.affiliations.sharing.directly')}
    </p>
    <div class="mx-auto flex flex-col w-full">
      {#if selectedAffiliation}
        <div>
          <span class="text-lg font-bold">
            {$_(`driver.org.affiliations.${selectedAffiliation.key}`)}
          </span>
          <div class="flex gap-2 w-full">
            <fieldset class="w-full">
              <legend class="text-sm">
                {$_('driver.org.affiliations.choose-if-you-would-like-to-share-data')}
              </legend>

              {#if selectedAffiliation.url}
                <ExternalLink href={selectedAffiliation.url} moreClasses="self-end"
                  >{$_('driver.settings.learn-more')}</ExternalLink
                >
              {/if}

              <div class="mt-4 flex gap-2 mb-4">
                <label
                  class={`grow btn basis-0 grow-1 sr ${shareChecked ? 'btn-neutral' : 'btn-outline'}`}
                >
                  <input
                    type="radio"
                    class="opacity-0 w-0 h-0 overflow-hidden block"
                    name="consentsToSelectedAffiliation"
                    value={true}
                    id="doesConsentToSelectedAffiliation"
                    checked={shareChecked}
                    onchange={() => {
                      dataSharingConsents.setConsent(selectedAffiliation.key, true);
                      shareDoNotShareIsTouched = true;
                    }}
                  />
                  {$_('driver.org.affiliations.share')}
                </label>
                <label
                  class={`grow btn basis-0 grow-1 sr ${doNotShareChecked ? 'btn-neutral' : 'btn-outline'}`}
                >
                  <input
                    type="radio"
                    class="opacity-0 w-0 h-0 overflow-hidden block"
                    name="consentsToSelectedAffiliation"
                    value={false}
                    id="doesConsentToSelectedAffiliation"
                    checked={doNotShareChecked}
                    onchange={() => {
                      dataSharingConsents.setConsent(selectedAffiliation.key, false);
                      shareDoNotShareIsTouched = true;
                    }}
                  />
                  {$_('driver.org.affiliations.do-not-share')}
                </label>
              </div>
            </fieldset>
          </div>
        </div>
      {/if}
    </div>
  {:else}
    <p>
      {$_('driver.org.affiliations.sharing.no-affiliation-selected')}

      <strong>{buttonText}</strong>.
    </p>
  {/if}

  <BottomDrawer>
    {#if isDemoMode}
      <DemoModePhoneIntake
        afterPhoneNumberSubmission={onButtonClick}
        {buttonText}
        buttonDisabled={!canContinue}
      />
    {:else}
      <button class="btn btn-neutral w-full" onclick={onButtonClick} disabled={!canContinue}>
        {buttonText}
      </button>
    {/if}
  </BottomDrawer>
</div>
