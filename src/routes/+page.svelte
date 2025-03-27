<script lang="ts">
  const email = 'theorganization@university.edu';
  import Modal from '@src/lib/components/Modal.svelte';
  import { title } from '@src/lib/stores/pageinfo';
  import { toast } from '@src/lib/toasts';
  import { _ } from 'svelte-i18n';
  import LanguageSelector from '@src/lib/components/layout/LanguageSelector.svelte';
  import LandingFooter from '@src/lib/components/layout/LandingFooter.svelte';
  import Input from '@src/lib/components/Input.svelte';

  title.set($_('home.get-system'));

  const submitUpdatesForm = async (e: Event) => {
    const form = e.target as HTMLFormElement;
    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());
    const res = await fetch('https://formspree.io/f/mqkvlpna', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    const json = await res.json();
    console.log('updates response:', json);
    if (json.ok) {
      signUpModal.closeModal();
      toast({ text: 'Thanks for signing up!', type: 'success' });
    } else {
      toast({ text: 'Something went wrong. Please try again.', type: 'error' });
    }
  };

  let signUpModal: { closeModal: () => void };
</script>

<div class="prose px-4">
  <div class="flex flex-row justify-end px-2 pt-2">
    <LanguageSelector />
  </div>
  <div class="flex justify-center">
    <a href="/">
      <img
        src="https://placehold.co/96"
        class="max-h-20"
        alt={$_('home.stylized-f-inside-of-a-circle-the-system-logo')}
      />
    </a>
  </div>
  <h1>
    {$_('home.lede')}
  </h1>

  <a href="/driver" class="btn btn-neutral mr-6 mt-4">
    {$_('home.join-the-study')}
  </a>
  <a href="/driver/login" class="btn btn-outline mt-4"> Log in </a>

  <h2>🚗 {$_('home.unveiling-fairness')}</h2>
  <p>
    {$_('home.ever-wondered-if-your-rides-fare-is-fair')}
    <span class="font-bold">System</span>
    {$_('home.is-a-new-tool-that-helps-drivers-and-riders')}
  </p>
  <p>
    {$_(
      'home.dreamed-up-by-worker-organizers-and-built-by-researchers-at-institutions-like-mit-and-university-def-were-dedicated-to-bringing-transparency-to-the-world-of-ridehail-fares'
    )} <span class="font-bold">{$_('home.university')}</span>
    {$_('home.and')} <span class="font-bold">{$_('home.university-def')}</span>{$_(
      'home.were-dedicated-to-bringing-transparency-to-the-world-of-ridehail-fares'
    )}
  </p>
  <div>
    <Modal
      buttonClass="btn"
      bind:this={signUpModal}
      title={$_('home.modal.enter-your-email')}
      id="sign-up-modal"
    >
      {#snippet buttonContent()}
        {$_('home.cta')}
      {/snippet}
      {#snippet dialogContent()}
        <div class="">
          <p>
            {$_('home.modal.sign-up-to-receive-things-like-early-updates')}
          </p>
          <form
            id="updates-form"
            action="https://formspree.io/f/mqkvlpna"
            method="POST"
            onsubmit={(event) => {
              event.preventDefault();
              submitUpdatesForm(event);
            }}
          >
            <div class="form-control">
              <Input
                label={$_('home.modal.your-email')}
                type="email"
                name="email"
                bottomLabel="dana@getsystem.org"
                required
              />
            </div>
            <input type="text" name="message" hidden aria-hidden="true" />
            <button id="updates-form-button" type="submit" class="btn btn-neutral">
              {$_('home.cta')}
            </button>
            <p id="updates-form-status"></p>
          </form>
        </div>
      {/snippet}
    </Modal>
  </div>
  <div class="p-4 md:p-8 bg-purple-100 rounded-xl my-4 mt-10">
    <h2 class="mt-0">{$_('home.behind-the-wheel')}</h2>
    <p>
      {$_('home.were-powered-by')}
      <a href="https://organization.university.edu/">{$_('home.powered-by-the-organization')}</a
      >{$_(
        'home.funded-by-the-mozilla-foundation-and-are-backed-by-driver-communities-like-pelq-and-gls'
      )}
    </p>
    <p class="mb-0">
      {$_('home.got-questions-or-just-wanna-say-hi')}
      <a href={`mailto:${email}`}>
        {$_('home.shoot-us-an-email')}
      </a>
    </p>
  </div>

  <div class="p-4 md:p-8 bg-purple-100 rounded-xl my-4">
    <h2 class="mt-0">{$_('home.research-questions')}</h2>
    <ul class="mb-0">
      <li>{$_('home.how-do-take-rates-vary-across-platforms-and-over-time')}</li>
      <li>
        {$_('home.do-take-rates-vary-based-on-driver-performance-location-or-other-factors')}
      </li>
      <li>{$_('home.how-accurate-are-driver-and-rider-estimates-of-take-rates')}</li>
      <li>{$_('home.how-do-perceptions-of-fairness-differ-between-drivers-and-riders')}</li>
      <li>{$_('home.what-changes-do-drivers-feel-are-important-to-make')}</li>
    </ul>
  </div>
</div>
<LandingFooter />
