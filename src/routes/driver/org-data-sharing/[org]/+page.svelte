<script lang="ts">
  import { _ } from 'svelte-i18n';
  import { title } from '@src/lib/stores/pageinfo';
  import { goto } from '$app/navigation';

  import { allAffiliations, affiliations, loadAllAffiliations } from '@src/lib/stores/affiliations';
  import { dataSharingConsents } from '@src/lib/stores/dataSharingConsents';
  import ConsentToDataSharing from '@src/lib/components/driver/ConsentToDataSharing.svelte';
  import SignupCodeGate from '@src/lib/components/driver/SignupCodeGate.svelte';
  import UseArgyle from '@src/lib/components/driver/UseArgyle.svelte';
  import { toast } from '@src/lib/toasts';
  import {
    createPrimaryDriverAffiliation,
    createSecondaryDriverAffiliation
  } from '@src/lib/client/driverOrgSharingApi';

  let { data } = $props();
  const { organization, requiresSignupCode, primaryAffiliation, hasArgyleAccounts } = data;

  title.set('Data Sharing');

  loadAllAffiliations();

  $effect(() => {
    if ($allAffiliations.length > 0) {
      dataSharingConsents.setAffiliateOrganizations($allAffiliations);
    }
  });

  $effect(() => {
    const target = $allAffiliations.find((o) => o.key === organization.key);
    if (target) {
      affiliations.toggleSelection(target);
      dataSharingConsents.setConsent(target.key, true);
    }
  });

  const isCurrentPrimary = $derived(primaryAffiliation?.key === organization.key);
  const isSecondaryFlow = $derived(
    !!primaryAffiliation && primaryAffiliation.key !== organization.key
  );
  const canAffiliateWithoutArgyle = $derived(!!primaryAffiliation || hasArgyleAccounts);

  let verifiedSignupCode = $state<string | null>(null);
  let isSubmitting = $state(false);
  let affiliationAdded = $state(false);
  let showArgyle = $state(false);

  const buttonText = $derived(
    canAffiliateWithoutArgyle
      ? $_('driver.org.update-data-sharing')
      : $_('driver.org.link-my-uber-lyft-account')
  );

  const handleSubmit = async () => {
    isSubmitting = true;
    try {
      const signupCode = verifiedSignupCode ?? undefined;

      if (isSecondaryFlow) {
        await createSecondaryDriverAffiliation({ orgKey: organization.key, signupCode });
        affiliationAdded = true;
        toast({ text: 'Successfully shared data with this organization', type: 'success' });
        return;
      }

      await createPrimaryDriverAffiliation({ orgKey: organization.key, signupCode });

      if (canAffiliateWithoutArgyle) {
        affiliationAdded = true;
        toast({ text: 'Successfully shared data with this organization', type: 'success' });
      } else {
        showArgyle = true;
      }
    } catch (error) {
      toast({
        text: error instanceof Error ? error.message : 'Something went wrong. Please try again.',
        type: 'error'
      });
    } finally {
      isSubmitting = false;
    }
  };
</script>

<div class="grid grid-row-flow-dense items-center w-full">
  {#if affiliationAdded}
    <div class="prose mx-auto text-center py-10">
      <h2>Data sharing enabled</h2>
      <p>
        You are now sharing your data with <strong>{organization.name}</strong>. Manage your
        affiliations in <a href="/driver/settings">Settings</a>.
      </p>
      <button class="btn btn-neutral mt-4" onclick={() => goto('/driver/settings')}>
        Go to settings
      </button>
    </div>
  {:else if isCurrentPrimary}
    <div class="prose mx-auto text-center py-10">
      <h2>{$_('driver.consent.key-information')}</h2>
      <p>
        You're already sharing data with <strong>{organization.name}</strong>. No further action is
        needed.
      </p>
      <a class="btn btn-neutral mt-4" href="/driver/settings">Go to settings</a>
    </div>
  {:else if requiresSignupCode && verifiedSignupCode === null}
    <SignupCodeGate orgKey={organization.key} onVerified={(code) => (verifiedSignupCode = code)} />
  {:else}
    <ConsentToDataSharing
      {buttonText}
      organizationFromUrl={organization.key}
      onButtonClick={handleSubmit}
      {isSubmitting}
    />
  {/if}

  <p class="text-xs px-2 pt-12 text-center">
    {$_('driver.consent.note-that-you-may-receive-a-login-confirmation-text')}
  </p>

  {#if showArgyle}
    <UseArgyle
      onAbortRedirectTo={`/driver/org-data-sharing/${organization.key}`}
      onSuccessRedirectTo="/driver/settings"
      orgKey={organization.key}
      onClose={() => (showArgyle = false)}
    />
  {/if}
</div>
