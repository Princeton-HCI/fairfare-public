<script lang="ts">
  import { onMount } from 'svelte';
  import { _ } from 'svelte-i18n';

  import ExternalLink from '@src/lib/components/ExternalLink.svelte';
  import BooleanAsIcon from '@src/lib/components/BooleanAsIcon.svelte';
  import Spinner from '@src/lib/components/Spinner.svelte';
  import CsvDataDownloadButton from '@src/lib/components/driver/CsvDataDownloadButton.svelte';
  import UseArgyle from '@src/lib/components/driver/UseArgyle.svelte';

  import { title } from '@src/lib/stores/pageinfo';
  import { argyleAccounts } from '@src/lib/stores/argyleAccounts';
  import { dataSharingConsents } from '@src/lib/stores/dataSharingConsents';
  import { affiliations } from '@src/lib/stores/affiliations';

  import CalendarEventFilled from '@src/lib/icons/CalendarEventFilled.svelte';
  import CarFilled from '@src/lib/icons/CarFilled.svelte';

  import type { PageProps } from './$types';
  import BottomDrawer from '@src/lib/components/BottomDrawer.svelte';

  title.set('Settings');

  let { data }: PageProps = $props();
  const {
    fullName,
    activitiesCount,
    dateSignedUp,
    userId,
    shortUserId,
    phoneNumberLastTwo,
    argyleUserId,
    allArgyleAccountsAreConnected,
    argyleAccounts: argyleAccountsFromDatabase,
    argyleUserToken
  } = data;

  const formattedDateSignedUp = dateSignedUp
    ? new Date(dateSignedUp).toLocaleDateString()
    : 'Missing date signed up';

  const initials = fullName
    ?.split(' ')
    .map((name) => name[0])
    .join('');

  onMount(async () => {
    // on load, we want to load the selected affiliations and data sharing consents
    affiliations.getSelectedAffiliationsFromDatabase();
    dataSharingConsents.getSelectedDataSharingConsentsFromDatabase();

    // update the stores
    if (argyleUserId) argyleAccounts.setUserId(argyleUserId);
    if (argyleUserToken) argyleAccounts.setToken(argyleUserToken);
  });

  // we need a list of organizations that are either selected for data sharing
  // or as affiliated organizations
  // the format should be like
  // [ { key: 'org1', name: 'Organization 1', isAffiliated: true, isDataSharing: true }, ... ]
  let selectedDataSharingConsents = $derived(
    $dataSharingConsents.selected.map((consent) => ({
      key: consent.key,
      name: consent.name,
      url: consent.url,
      isDataSharing: true,
      isAffiliated: undefined
    }))
  );

  let selectedAffiliation = $derived(
    $affiliations.selected && {
      key: $affiliations.selected.key,
      name: $affiliations.selected.name,
      url: $affiliations.selected.url,
      isDataSharing: undefined,
      isAffiliated: true
    }
  );

  let organizationKeysForTable = $derived(
    selectedAffiliation
      ? [
          ...new Set(
            selectedDataSharingConsents.map((org) => org.key).concat([selectedAffiliation.key])
          )
        ]
      : [...new Set(selectedDataSharingConsents.map((org) => org.key))]
  );

  let organizationsForTable = $derived(
    organizationKeysForTable.map((key) => {
      const selectedDataSharingConsent = selectedDataSharingConsents.find((org) => org.key === key);
      return {
        key: key,
        name: selectedAffiliation?.name || selectedDataSharingConsent?.name,
        isAffiliated: selectedAffiliation?.key === key,
        isDataSharing: selectedDataSharingConsent?.isDataSharing || false,
        url: selectedAffiliation?.url || selectedDataSharingConsent?.url
      };
    })
  );

  let showArgyle = $state(false);
</script>

<div class="prose">
  <h1>
    {$_('nav.settings')}
  </h1>
  <h2 class="font-medium text-left text-xl mb-4 mt-8">
    {$_('driver.settings.your-information-in-system')}
  </h2>

  <div class="bg-neutral text-neutral-content flex gap-4 items-center p-4">
    <div
      class="bg-accent rounded-full h-12 w-12 flex items-center justify-center font-medium text-lg"
    >
      {initials}
    </div>
    <div class="grow flex gap-1 flex-col">
      <div class="font-bold">{fullName}</div>
      <div class="text-xs flex items-center gap-2">
        <div class="flex items-center gap-1">
          <CarFilled />
          <span>
            {activitiesCount?.toLocaleString()}
            {$_('driver.settings.trips')}
          </span>
        </div>
        <div class="flex items-center gap-1">
          <CalendarEventFilled />
          <span>
            {$_('driver.settings.joined')}
            {formattedDateSignedUp}
          </span>
        </div>
      </div>
    </div>
  </div>

  {#if argyleAccountsFromDatabase}
    {#each argyleAccountsFromDatabase as account}
      <dl class="grid grid-cols-2 gap-y-2 bg-white p-4 mt-4">
        <dt class="border-b font-normal m-0 p-0">
          {$_('driver.settings.account')}
        </dt>
        <dd class="border-b font-bold text-right m-0 p-0 pb-2">
          {account.employers.join(', ')}
        </dd>
        <dt class="border-b font-normal m-0 p-0">
          {$_('driver.settings.status')}
        </dt>
        <dd class="border-b font-bold text-right m-0 p-0 pb-2">
          {account.connection.status}
        </dd>
        <dt class="border-b font-normal m-0 p-0">
          {$_('driver.settings.gigs')}
        </dt>
        <dd class="border-b font-bold text-right m-0 p-0 pb-2">
          {account.availability.gigs.available_count.toLocaleString()}
        </dd>
        <dt class="border-b font-normal m-0 p-0">
          {$_('driver.settings.created-at')}
        </dt>
        <dd class="border-b font-bold text-right m-0 p-0 pb-2">
          {new Date(account.created_at).toLocaleDateString()}
        </dd>
      </dl>
    {/each}
  {:else}
    {$_('driver.settings.no-accounts-found')}
  {/if}

  {#if allArgyleAccountsAreConnected}
    <button onclick={() => (showArgyle = true)} class="btn btn-outline">
      {$_('driver.settings.review-my-linked-accounts')}
    </button>
    <p class="mt-1 text-sm">
      {$_('driver.settings.all-of-your-linked-accounts-are-up-to-date')}
    </p>
  {:else}
    <p class="font-bold text-error mb-1">
      {$_('driver.settings.your-linked-accounts-are-out-of-date')}
    </p>
    <button onclick={() => (showArgyle = true)} class="btn btn-primary">
      {$_('driver.settings.review-my-linked-accounts')}
    </button>
  {/if}

  <p class="mt-4">
    <a href="/driver/data/{shortUserId}" class="btn btn-neutral">
      {$_('driver.settings.view-my-take-rate-data')}
    </a>
  </p>

  {#if showArgyle}
    <UseArgyle
      onAbortRedirectTo="/driver/settings"
      onSuccessRedirectTo="/driver/settings"
      onClose={() => (showArgyle = false)}
    />
  {/if}

  <h2 class="font-medium text-xl self-start leading-none mt-8 mb-4">
    {$_('driver.settings.your-affiliation-and-data-sharing')}
  </h2>
  {#if $affiliations.selectedAffiliationsAreLoadedFromDatabase}
    {#each organizationsForTable as { name, url, isAffiliated, isDataSharing }}
      <div class="bg-white flex gap-2 p-4 flex-col mt-4">
        <span class="font-bold leading-tight">{name}</span>
        <div class="flex gap-3 items-center text-sm">
          <div class="flex gap-1 items-center">
            <BooleanAsIcon value={isAffiliated} />
            <span>{$_('driver.settings.affiliated')}</span>
          </div>
          <div class="flex gap-1 items-center">
            <BooleanAsIcon value={isDataSharing} />
            <span>{$_('driver.settings.sharing-data')}</span>
          </div>
        </div>
      </div>
      {#if url}
        <ExternalLink href={url}>{$_('driver.settings.learn-more-about')} {name}</ExternalLink>
      {/if}
    {/each}
  {:else}
    <Spinner />
  {/if}

  <p>
    <a href="/driver/opt-out" class="btn btn-error btn-outline" type="submit">
      {$_('driver.settings.opt-out')}
    </a>
  </p>

  <BottomDrawer orientation="vertical">
    {#if userId && phoneNumberLastTwo}
      <CsvDataDownloadButton
        {userId}
        {phoneNumberLastTwo}
        title={$_('driver.settings.download-my-data')}
      />
    {/if}

    <a class="btn btn-ghost" href="/driver/settings/org">
      {$_('driver.data.manage-data-sharing')}
    </a>
  </BottomDrawer>
</div>
