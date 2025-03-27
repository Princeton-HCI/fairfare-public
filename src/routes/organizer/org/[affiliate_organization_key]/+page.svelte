<script lang="ts">
  import short from 'short-uuid';

  import { page } from '$app/state';
  import { title } from '@src/lib/stores/pageinfo';
  import { locale } from 'svelte-i18n';

  import DriverNamePhoneAndEmail from '@src/lib/components/organizer/DriverNamePhoneAndEmail.svelte';
  import { driverHasSynced, type ProfileWithDetails } from '../../utils';

  let { data } = $props();
  const { totalDriversSignedUp, profiles } = data;

  if (!profiles) {
    throw new Error('No profiles found');
  }

  const organizationKey = page.params.affiliate_organization_key;

  const translator = short();

  let searchQuery = $state('');

  let filteredProfiles = $derived(
    searchQuery
      ? profiles.filter((profile: ProfileWithDetails) => {
          const name = `${profile.first_name} ${profile.last_name}`;
          const phone = profile.phone;
          const email = profile.email;
          return (
            name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            phone?.includes(searchQuery) ||
            email?.includes(searchQuery)
          );
        })
      : profiles
  );

  let sortOrder = $state('date_consented');

  let filteredAndSortedProfiles = $derived(
    filteredProfiles.sort((a: ProfileWithDetails, b: ProfileWithDetails) => {
      if (sortOrder === 'date_consented') {
        const aDate = new Date(a.driver_affiliate_organization_data_sharing_consents[0].created_at);
        const bDate = new Date(b.driver_affiliate_organization_data_sharing_consents[0].created_at);
        return bDate.getTime() - aDate.getTime();
      }
      if (sortOrder === 'last_name') {
        if (!a.last_name) {
          return -1;
        }
        if (!b.last_name) {
          return 1;
        }
        return a.last_name.localeCompare(b.last_name);
      }
      return 0;
    })
  );

  title.set('Organizer | Drivers');

  let organizationName = $derived(
    profiles.length > 0 &&
      profiles[0].driver_affiliate_organization_data_sharing_consents[0].affiliate_organization.name
  );
</script>

<div class="max-w-lg mx-auto">
  <h1 class="text-3xl font-bold my-4">{organizationName}</h1>
  <dl class="grid grid-rows-2 grid-flow-col gap-x-12 gap-y-2 text-center my-8">
    <dt class="font-medium text-4xl">{totalDriversSignedUp}</dt>
    <dd>selected affiliation with {organizationName}</dd>
    <dt class="font-medium text-4xl">{profiles.length}</dt>
    <dd>drivers successfully shared data with {organizationName}</dd>
    <dt class="font-medium text-4xl">{totalDriversSignedUp - profiles.length}</dt>
    <dd>
      drivers who chose to share data with {organizationName}, but did not link their rideshare
      accounts
    </dd>
  </dl>

  <div class="w-full bg-white px-2 py-4 rounded-sm border">
    <h2 class="text-xl font-bold my-2">Drivers sharing data</h2>

    <div class="my-2 grid grid-cols-[1fr_2fr] gap-2">
      <!-- TODO: add a label here -->
      <select class="select select-bordered bg-white w-full max-w-xs" bind:value={sortOrder}>
        <option selected value="date_consented">Date consented</option>
        <option value="last_name">Last name</option>
      </select>
      <label class="input input-bordered flex items-center gap-2">
        <input
          type="text"
          class="grow bg-transparent"
          placeholder="Search"
          bind:value={searchQuery}
        />
        <!-- FIXME: move to icons directory -->
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 16 16"
          fill="currentColor"
          class="w-4 h-4 opacity-70"
          ><path
            fill-rule="evenodd"
            d="M9.965 11.026a5 5 0 1 1 1.06-1.06l2.755 2.754a.75.75 0 1 1-1.06 1.06l-2.755-2.754ZM10.5 7a3.5 3.5 0 1 1-7 0 3.5 3.5 0 0 1 7 0Z"
            clip-rule="evenodd"
          /></svg
        >
      </label>
    </div>

    <ul class="border-t-2" data-testid="drivers-list">
      {#each filteredAndSortedProfiles as driver}
        <li class="border-b-2">
          <a
            href={`${organizationKey}/${translator.fromUUID(driver.user_id)}`}
            class="flex justify-between items-center"
          >
            <div>
              <DriverNamePhoneAndEmail
                phone={driver.phone}
                fullName={driver.first_name + ' ' + driver.last_name}
                hasSynced={driverHasSynced(driver)}
                email={driver.email}
              />

              <p class="text-sm">
                Shared data on
                <time
                  datetime={driver.driver_affiliate_organization_data_sharing_consents[0]
                    .created_at}
                >
                  {new Date(
                    driver.driver_affiliate_organization_data_sharing_consents[0].created_at
                  ).toLocaleDateString($locale?.toString() || 'en-US', {
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric'
                  })}
                </time>
              </p>
            </div>
            <!-- FIXME: move to icons directory -->
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="icon icon-tabler icon-tabler-chevron-right"
              width="44"
              height="44"
              viewBox="0 0 24 24"
              stroke-width="1.5"
              stroke="#2c3e50"
              fill="none"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path stroke="none" d="M0 0h24v24H0z" fill="none" />
              <path d="M9 6l6 6l-6 6" />
            </svg>
          </a>
        </li>
      {/each}

      {#if filteredAndSortedProfiles.length === 0 && searchQuery}
        <li class="text-center p-4">No drivers found matching search "{searchQuery}"</li>
      {:else if filteredAndSortedProfiles.length === 0}
        <li class="text-center p-4">No drivers found</li>
      {/if}
    </ul>
  </div>
</div>
