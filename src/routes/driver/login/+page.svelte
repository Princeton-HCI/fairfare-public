<script lang="ts">
  import { title } from '@src/lib/stores/pageinfo';
  import DriverOtpLogin from '@src/lib/components/DriverOtpLogin.svelte';
  import { _ } from 'svelte-i18n';

  title.set('Log in');
</script>

<DriverOtpLogin redirectUrl="/driver/settings" />
