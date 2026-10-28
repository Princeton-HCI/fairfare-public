<script lang="ts">
  import ChooseAffiliateOrganization from '../../../lib/components/ChooseAffiliateOrganization.svelte';
  import { title } from '@src/lib/stores/pageinfo';
  import { supabase } from '@src/lib/client/db';
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';

  title.set('Choose an Organization');

  // redirect to landing page if user is not logged in
  onMount(async () => {
    const {
      data: { session }
    } = await supabase.auth.getSession();
    if (!session) {
      goto('/driver/landing');
    }
  });
</script>

<ChooseAffiliateOrganization />
