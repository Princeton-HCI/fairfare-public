<script lang="ts">
  import { toast } from '@src/lib/toasts';
  import { affiliations, allAffiliations, loadAllAffiliations } from '@src/lib/stores/affiliations';
  import { dataSharingConsents } from '@src/lib/stores/dataSharingConsents';
  import { _ } from 'svelte-i18n';
  import ExternalLink from '../ExternalLink.svelte';
  import BottomDrawer from '../BottomDrawer.svelte';
  import UseArgyle from './UseArgyle.svelte';
  import Spinner from '@src/lib/components/Spinner.svelte';
  import { PUB_SUPPORT_EMAIL } from '$env/static/public';

  interface Props {
    buttonText: string;
    onButtonClick?: () => void;
    isSubmitting?: boolean;
    preloadSelectedConsents?: boolean;
    affiliateOrganizationName?: string;
    affiliateOrganizationEmail?: string;
    organizationFromUrl?: string;
  }

  let showArgyle = $state(false);
  let isLoading = $state(false);

  let {
    buttonText,
    onButtonClick = async () => {
      try {
        isLoading = true;
        await Promise.all([dataSharingConsents.updateDatabase(), affiliations.updateDatabase()]);
        showArgyle = true;
      } catch (error) {
        console.log(error);
        toast({ text: $_('driver.settings.something-went-wrong-please-try-again'), type: 'error' });
        return;
      } finally {
        isLoading = false;
      }
    },
    isSubmitting = undefined,
    preloadSelectedConsents = false,
    affiliateOrganizationName = 'the affiliate organization',
    affiliateOrganizationEmail = 'affiliate@example.com',
    organizationFromUrl = undefined
  }: Props = $props();

  let effectiveIsLoading = $derived(isSubmitting ?? isLoading);

  const optOutLink = 'https://getsystem.org/driver/opt-out';

  if (preloadSelectedConsents) {
    dataSharingConsents.getSelectedDataSharingConsentsFromDatabase();
  }

  // Load organizations from DB and sync to data sharing consents store
  loadAllAffiliations();

  let _orgFromUrlHandled = false;

  $effect(() => {
    const orgs = $allAffiliations;
    if (orgs.length > 0) {
      dataSharingConsents.setAffiliateOrganizations(orgs);

      // If organization is provided in URL, automatically select it but don't pre-select consent
      if (organizationFromUrl && !_orgFromUrlHandled) {
        const orgFromUrl = orgs.find((org) => org.key === organizationFromUrl);
        if (orgFromUrl) {
          affiliations.toggleSelection(orgFromUrl);
        }
        _orgFromUrlHandled = true;
      }
    }
  });

  let selectedAffiliation = $derived($affiliations.selected);
  let shareDoNotShareIsTouched = $state(false);

  // Get actual affiliate org name from selected affiliation
  let internationalizedSelectedAffiliationName = $derived(
    selectedAffiliation ? selectedAffiliation.name : affiliateOrganizationName
  );
  let consentsToSelectedAffiliation = $derived(
    selectedAffiliation &&
      !!$dataSharingConsents.selected.find((dsc) => dsc.key === selectedAffiliation.key)
  );

  let canContinue = $derived(selectedAffiliation ? shareDoNotShareIsTouched : true);
  let doNotShareChecked = $derived(
    shareDoNotShareIsTouched ? consentsToSelectedAffiliation === false : false
  );
  let shareChecked = $derived(
    shareDoNotShareIsTouched ? consentsToSelectedAffiliation === true : false
  );
</script>

<div class="prose">
  <!-- IRB Consent Information -->
  <h1>{$_('driver.consent.key-information')}</h1>
  <p>{$_('driver.consent.informed-consent-sought')}</p>

  <p>
    <strong>{$_('driver.consent.purpose')}</strong>
    {$_('driver.consent.purpose-description')}
  </p>

  <p>
    <strong>{$_('driver.consent.duration')}</strong>
    {$_('driver.consent.duration-description', {
      values: { affiliate_org_name: internationalizedSelectedAffiliationName }
    })}
  </p>

  <p>
    <strong>{$_('driver.consent.procedures')}</strong>
    {$_('driver.consent.procedure-descriptions')}
  </p>

  <p>
    <strong>{$_('driver.consent.risks')}</strong>
  </p>
  <ul>
    <li>
      {$_('driver.consent.risks-affiliate-controls', {
        values: { affiliate_org_name: internationalizedSelectedAffiliationName }
      })}
    </li>
    <li>{$_('driver.consent.risks-data-breaches')}</li>
  </ul>

  <p>
    <strong>
      {$_('driver.consent.benefits')}
    </strong>
    {$_('driver.consent.benefits-description', {
      values: { affiliate_org_name: internationalizedSelectedAffiliationName }
    })}
  </p>

  <h3>{$_('driver.consent.what-data-will-i-share')}</h3>
  <ul>
    <li>{$_('driver.consent.data-name-phone-email')}</li>
    <li>{$_('driver.consent.data-ride-history')}</li>
    <li>{$_('driver.consent.data-vehicle')}</li>
  </ul>

  <h3>{$_('driver.consent.who-has-access')}</h3>
  <p>
    {$_('driver.consent.access-researchers-partner')}
  </p>

  <h3>{$_('driver.consent.additional-information')}</h3>

  <p>
    <strong>{$_('driver.consent.confidentiality')}</strong>
    {$_('driver.consent.confidentiality-description', {
      values: { affiliate_org_name: internationalizedSelectedAffiliationName }
    })}
  </p>

  <p>
    <strong>{$_('driver.consent.data-deletion')}</strong>
    {$_('driver.consent.data-deletion-detail', {
      values: {
        support_email: PUB_SUPPORT_EMAIL,
        insert_link: optOutLink,
        affiliate_org_name: internationalizedSelectedAffiliationName,
        affiliate_org_email: affiliateOrganizationEmail
      }
    })}
  </p>

  <p>
    <strong>{$_('driver.consent.compensation')}</strong>
    {$_('driver.consent.compensation-detail')}
  </p>

  <p>
    <strong>{$_('driver.consent.who-to-contact')}</strong>
  </p>

  <p>{$_('driver.consent.principal-investigator-contact')}</p>
  <blockquote>
    Prof. Andrés Monroy-Hernández,<br />
    {PUB_SUPPORT_EMAIL}
  </blockquote>

  <p>
    {$_('driver.consent.irb-contact')}<br />
  </p>
  <blockquote>
    {$_('driver.consent.irb-assistant-director')}<br />
    {$_('driver.consent.irb-phone')}
  </blockquote>

  <p>
    <strong>{$_('driver.consent.consent')}</strong>
    {$_('driver.consent.consent-description')}
  </p>

  <!-- Original Data Sharing Section -->
  <h2>
    {$_('driver.org.affiliations.sharing.can-we-share')}
  </h2>
  {#if selectedAffiliation?.key}
    <p class="text-base mb-4">
      {$_('driver.org.affiliations.sharing.if-you-opt-in-the')} <strong>Organization</strong>
      {$_('driver.org.affiliations.sharing.will-share-data-with')}
      <strong>{selectedAffiliation.name}</strong>.
      {$_('driver.org.affiliations.sharing.after-data-is-shared')} <strong>Organization</strong>
      {$_('driver.org.affiliations.sharing.cannot-manage-or-delete')}
      <strong>{selectedAffiliation.name}</strong>
      {$_('driver.org.affiliations.sharing.directly')}
    </p>
    <div class="mx-auto flex flex-col w-full">
      {#if selectedAffiliation}
        <div>
          <span class="text-xl font-bold">
            {selectedAffiliation.name}
          </span>
          <div class="flex gap-2 w-full">
            <fieldset class="w-full">
              <legend class="text-base font-medium mb-2">
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
                    id="shareConsent"
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
                    id="doNotShareConsent"
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
    <p class="text-base">
      {$_('driver.org.affiliations.sharing.no-affiliation-selected')}
      <strong>{buttonText}</strong>.
    </p>
  {/if}

  {#if showArgyle}
    <UseArgyle onAbortRedirectTo="/driver/org-data-sharing" onClose={() => (showArgyle = false)} />
  {/if}

  <BottomDrawer>
    <button
      class="btn btn-neutral w-full"
      onclick={onButtonClick}
      disabled={!canContinue || effectiveIsLoading}
    >
      {#if effectiveIsLoading}
        <Spinner />
      {:else}
        {buttonText}
      {/if}
    </button>
  </BottomDrawer>
</div>
