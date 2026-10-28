<script lang="ts">
  import { _ } from 'svelte-i18n';
  import { TelInput, normalizedCountries } from 'svelte-tel-input';
  import type { CountryCode } from 'svelte-tel-input/types';

  let selectedCountry = $state(<CountryCode>'US');
  let { showOtpInput = false, phoneNumber = $bindable() } = $props();
  function handleInput() {
    if (phoneNumber.includes('+')) {
      phoneNumber = phoneNumber.replace('+', '');
    }
  }
</script>

<div class="flex">
  <!-- Country code select  -->
  <select
    class="w-[130px] mr-2 px-4 py-2 border border-black"
    aria-label="Phone country code"
    name="Country"
    bind:value={selectedCountry}
  >
    <option value={null} hidden={selectedCountry !== null}>Please select</option>
    {#each normalizedCountries as currentCountry (currentCountry.id)}
      <option
        value={currentCountry.iso2}
        selected={currentCountry.iso2 === selectedCountry}
        aria-selected={currentCountry.iso2 === selectedCountry}
      >
        {currentCountry.iso2} (+{currentCountry.dialCode})
      </option>
    {/each}
  </select>
  <!-- Phone number input  -->
  <TelInput
    label={$_('components.DriverOtpLogin.phone-number')}
    id="phoneNumber"
    name="phoneNumber"
    bind:country={selectedCountry}
    bind:value={phoneNumber}
    class="w-full px-4 py-2 border border-black"
    aria-label="Enter your phone number"
    required
    disabled={showOtpInput}
    on:input={handleInput}
  />
</div>
<span class="label-text-alt">{$_('components.PhoneNumberInput.enter-your-phone')}</span>
