<script lang="ts">
  import Spinner from '@src/lib/components/Spinner.svelte';

  import { supabase } from '@src/lib/client/db';
  import { goto } from '$app/navigation';
  import { toast } from '@src/lib/toasts';
  import Input from './Input.svelte';
  import BottomDrawer from './BottomDrawer.svelte';
  import { _ } from 'svelte-i18n';

  let { redirectUrl } = $props();

  const onPhoneSubmit = async (event: Event) => {
    isLoading = true;
    const formData = new FormData(event.target as HTMLFormElement);
    const formPhoneNumber = formData.get('phoneNumber');

    // hit the API to verify the OTP
    const response = await fetch('/driver/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phoneNumber: formPhoneNumber
      })
    });
    isLoading = false;
    if (response.ok) {
      // show the OTP input
      toast({
        text: $_('components.DriverOtpLogin.sent-an-otp-if-this-phone-number-is-registered'),
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
    const formPhoneNumber = formData.get('phoneNumber');
    const formToken = formData.get('otp');

    // hit the API to verify the OTP
    const response = await fetch('/driver/verify-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phone: formPhoneNumber,
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
      // pop a toast
      toast({
        text: 'Successfully logged in!',
        type: 'success'
      });
      await goto(redirectUrl);
    } else {
      error = await response.json();
    }
  };

  let isLoading = $state(false);
  let showOtpInput = $state(false);
  let error = $state(null) as { message: string } | null;
</script>

<div class="prose">
  <h1>{$_('components.DriverOtpLogin.log-in')}</h1>

  <form
    onsubmit={(event) => {
      if (showOtpInput) {
        onTokenSubmit(event);
      } else {
        onPhoneSubmit(event);
      }
    }}
  >
    <Input
      label={$_('components.DriverOtpLogin.phone-number')}
      bottomLabel={$_('components.DriverOtpLogin.phoneFormat')}
      type="tel"
      name="phoneNumber"
      readonly={showOtpInput}
      required
    />
    {#if showOtpInput}
      <Input
        label={$_('components.DriverOtpLogin.one-time-passcode')}
        bottomLabel={$_('components.DriverOtpLogin.format-222333')}
        type="number"
        name="otp"
        maxlength={6}
        required
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
    <a href="mailto:organization@university.edu" class="font-medium underline"
      >organization@university.edu</a
    >.
  </p>
</div>
