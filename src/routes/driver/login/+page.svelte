<script lang="ts">
  import { title } from '@src/lib/stores/pageinfo';
  import DriverOtpLogin from '@src/lib/components/DriverOtpLogin.svelte';
  import { _ } from 'svelte-i18n';
  import { page } from '$app/state';

  title.set('Log in or sign up');

  // Get redirect URL from query parameters, default to /driver/settings
  const redirectUrl = page.url.searchParams.get('redirect') || '/driver/settings';
</script>

<DriverOtpLogin {redirectUrl} />
