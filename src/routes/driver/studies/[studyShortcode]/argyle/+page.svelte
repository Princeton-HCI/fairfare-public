<script lang="ts">
  import { _ } from 'svelte-i18n';
  import { onMount } from 'svelte';

  import { affiliations } from '@src/lib/stores/affiliations';
  import { title } from '@src/lib/stores/pageinfo';
  import { dataSharingConsents } from '@src/lib/stores/dataSharingConsents';
  import { argyleAccounts } from '@src/lib/stores/argyleAccounts';

  import { supabase } from '@src/lib/client/db';
  import UseArgyle from '@src/lib/components/driver/UseArgyle.svelte';
  import BottomDrawer from '@src/lib/components/BottomDrawer.svelte';

  let showArgyle = $state(false);

  let { data } = $props();
  const {
    studyDetails: { title: studyTitle, shortcode: studyShortcode },
    affiliateOrganization,
    argyleLinkIds,
    session,
    argyleUserId,
    argyleUserToken
  } = data;

  title.set(`Signup: ${studyTitle}`);

  // if we're on /argyle, load Argyle Link. otherwise, close it.
  onMount(async () => {
    // log the user in
    await supabase.auth.setSession(session);

    // update the stores
    argyleAccounts.setUserId(argyleUserId);
    argyleAccounts.setToken(argyleUserToken);
    affiliations.toggleSelection(affiliateOrganization);
    dataSharingConsents.setAffiliateOrganizations([affiliateOrganization]);

    // perform the data sharing consent
    // TODO: do this when the user clicks consent on FF, future screens
    dataSharingConsents.setConsent(studyShortcode, true);
    await dataSharingConsents.updateDatabase();
    console.log('consents updated');
  });

  const onAbortRedirectTo = `/driver/studies/${studyShortcode}/argyle` + window.location.search;
</script>

<div class="prose text-center">
  <h1>
    {$_('driver.argyle.you-might-get-a-warning-about-your-account-but-dont-worry')}
  </h1>

  <p>
    {$_(
      'driver.argyle.were-about-to-ask-you-to-log-into-your-gig-account-securely-when-you-do-you-might-get-a-notification-about-an-unexpected-login'
    )}
    <br />
  </p>
  <img
    src="/img/uber-did-you-just-login.jpg"
    class="rounded-[17px] h-16 mx-auto my-4"
    alt="A notification from Uber with the text 'Did you just login? We've detected a new device login on your account. Please contact support if ...'"
  />
  <p>
    {$_(
      'driver.argyle.your-credentials-are-only-used-to-access-your-gig-work-data-and-are-not-readable-by-anyone'
    )}
  </p>
  <BottomDrawer orientation="vertical">
    <button class="btn btn-neutral" onclick={() => (showArgyle = true)}>
      {$_('driver.argyle.continue')}
    </button>
  </BottomDrawer>
</div>
{#if showArgyle}
  <UseArgyle {argyleLinkIds} {onAbortRedirectTo} onClose={() => (showArgyle = false)} />
{/if}
