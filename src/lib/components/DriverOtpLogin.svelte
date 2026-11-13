<script lang="ts">
  import Spinner from '@src/lib/components/Spinner.svelte';
  import { onMount } from 'svelte';

  import { supabase } from '@src/lib/client/db';
  import { goto } from '$app/navigation';
  import { toast } from '@src/lib/toasts';
  import Input from './Input.svelte';
  import BottomDrawer from './BottomDrawer.svelte';
  import { _ } from 'svelte-i18n';

  import PhoneNumberInput from './PhoneNumberInput.svelte';
  import { PUB_SUPPORT_EMAIL } from '$env/static/public';
  import { isDemoMode } from '@src/lib/utils';
  import { userDemoPhoneNumber } from '@src/lib/stores/userDemoPhoneNumber';
  import { DEMO_OTP } from '$lib/demo/constants';

  let { redirectUrl } = $props();
  let otpInput = $state<HTMLInputElement | undefined>(undefined);

  // skip the login if the user is already logged in
  onMount(async () => {
    const {
      data: { session }
    } = await supabase.auth.getSession();
    if (session) {
      await goto(redirectUrl);
    }
  });

  const onPhoneSubmit = async () => {
    isLoading = true;

    // hit the API to verify the OTP
    const response = await fetch('/driver/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phoneNumber: phoneNumber
      })
    });
    isLoading = false;
    if (response.ok) {
      // show the OTP input
      toast({
        text: $_('components.DriverOtpLogin.sent-an-otp'),
        type: 'success'
      });
      showOtpInput = true;
      error = null;
    } else {
      console.log('error', response);
      toast({
        text: `An error occurred: ${response.statusText}. Please try again.`,
        type: 'error'
      });
      error = await response.json();
    }
  };

  const onTokenSubmit = async (event: Event) => {
    isLoading = true;
    const formData = new FormData(event.target as HTMLFormElement);
    const formToken = formData.get('otp');

    // hit the API to verify the OTP
    const response = await fetch('/driver/verify-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phone: phoneNumber,
        token: formToken
      })
    });
    isLoading = false;
    if (response.ok) {
      const data = await response.json();
      // Sets the session here so that the credentials are available to the
      // onSuccessfulLogin callback.
      await supabase.auth.setSession({
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token
      });

      // In demo mode, store the user's phone number for fake SMS preview later
      if (isDemoMode) {
        userDemoPhoneNumber.set(phoneNumber);
      }

      // pop a toast
      toast({
        text: 'Successfully logged in/signed up!',
        type: 'success'
      });
      await goto(redirectUrl);
    } else {
      error = await response.json();
    }
  };

  let isLoading = $state(false);
  let phoneNumber = $state('');
  let showOtpInput = $state(false);
  let otpValue = $state(isDemoMode ? DEMO_OTP : '');
  let error = $state(null) as { message: string } | null;

  $effect(() => {
    if (showOtpInput) {
      // Use setTimeout to ensure the input is rendered before focusing
      setTimeout(() => {
        otpInput?.focus();
      }, 0);
    }
  });
</script>

<div class="prose">
  <h1>{$_('components.DriverOtpLogin.log-in-or-sign-up')}</h1>

  <form
    onsubmit={(event) => {
      // prevent default
      event.preventDefault();
      if (showOtpInput) {
        onTokenSubmit(event);
      } else {
        onPhoneSubmit();
      }
    }}
  >
    <PhoneNumberInput {showOtpInput} bind:phoneNumber />
    {#if showOtpInput}
      <Input
        label={$_('components.DriverOtpLogin.one-time-passcode')}
        bottomLabel={isDemoMode
          ? $_('demo.login.format_with_hint')
          : $_('components.DriverOtpLogin.format-222333')}
        type="number"
        name="otp"
        maxlength={6}
        required
        bind:element={otpInput}
        bind:value={otpValue}
      />
    {/if}
    <div class="flex justify-center h-8 items-center">
      {#if isLoading}
        <Spinner />
      {/if}
    </div>
    {#if error}
      <div class="border border-error text-error p-2 my-2 rounded flex justify-center" role="alert">
        <p class="block sm:inline font-medium m-0">{error?.message}</p>
      </div>
    {/if}
    <BottomDrawer orientation="horizontal">
      <a href="/" class="btn btn-ghost">{$_('driver.login.return-home')}</a>
      <button type="submit" class="btn btn-neutral" disabled={isLoading}>
        {showOtpInput
          ? $_('components.DriverOtpLogin.verify')
          : $_('components.DriverOtpLogin.submit')}
      </button>
    </BottomDrawer>
  </form>
  <p>
    {$_('components.DriverOtpLogin.for-help-logging-in-please-email')}{' '}
    <a href="mailto:{PUB_SUPPORT_EMAIL}" class="font-medium underline">{PUB_SUPPORT_EMAIL}</a>.
  </p>
</div>
