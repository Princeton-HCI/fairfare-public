<script lang="ts">
  import { page } from '$app/state';
  import { title } from '@src/lib/stores/pageinfo';
  import TakeInfo from '../TakeInfo.svelte';
  import { _ } from 'svelte-i18n';

  title.set('Take rate');

  let aggregate = page.data.aggregate ?? null;
  let byPlatform = page.data.byPlatform ?? [];
  let unsupportedEmployers = page.data.unsupportedEmployers ?? [];
  let monthsSinceMinDateToShow = page.data.monthsSinceMinDateToShow;
  let userId = page.data.userId;
  let phoneNumberLastTwo = page.data.phoneNumberLastTwo;

  let hasError = page.data.hasError;
  let errorI18nKey = page.data.errorI18nKey;
</script>

<div class="prose">
  <TakeInfo
    {aggregate}
    {byPlatform}
    {unsupportedEmployers}
    {monthsSinceMinDateToShow}
    {hasError}
    {errorI18nKey}
    {userId}
    {phoneNumberLastTwo}
  />

  <p>
    {$_(
      'driver.survey.takeinfo.a-take-rate-is-the-proportion-of-a-fare-ignoring-tips-composed-of-ubers-fees'
    )}
  </p>
  <p>
    {$_(
      'driver.survey.takeinfo.we-calculate-your-take-rate-based-on-uber-fares-classified-as-rideshare-from-last-six-months'
    )}
  </p>
</div>
