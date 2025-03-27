<script lang="ts">
  import { locale } from 'svelte-i18n';
  import { title } from '@src/lib/stores/pageinfo';

  import BreadCrumb from '@src/lib/components/BreadCrumb.svelte';

  title.set('Instructions');
  locale.set('en');
</script>

<BreadCrumb returnUrl="/driver/landing" text="← Return to signup page" />
<div class="prose">
  <h1>Signup Instructions</h1>

  <p>
    Hello drivers! PELQ is partnering with researchers at University and University to study fair
    take rates and ridehail fairness.
    <strong> Signing up takes 5 minutes, and you’ll get insights about actual take rate. </strong>
  </p>
  <p class="text-center">
    <a href="/driver/org" class="btn btn-neutral"> Join Our Study </a>
  </p>
  <p>For detailed signup instructions, follow the three steps below.</p>
  <h2>Step 1: Join the Study</h2>
  <ul>
    <li>
      Open <a href="https://getsystem.org/driver">getsystem.org/driver</a>
      on your phone
    </li>
    <li>To get started, click “<strong>Join Our Study</strong>”</li>
  </ul>
  <div class="max-w-[250px] m-auto">
    <img
      src="/img/instructions/how-much-is-uber-taking.jpg"
      class="border border-black"
      alt="A screenshot of the System interface with a red arrow pointing at the 'Join Our Study' button."
    />
  </div>
  <ul>
    <li>Optionally select an affiliated organization and click “<strong>Continue</strong>”</li>
    <li>
      Optionally choose to share your data with your affiliated organization and click “<strong
        >Link My Uber/Lyft Account</strong
      >” to link your account or accounts
    </li>
    <li>The app will take you to Argyle so you can add your job data to our study</li>
  </ul>
  <h2>Step 2: Link your data</h2>
  <ul>
    <li>Log in by selecting phone or email – phone may be easier</li>
    <li>Enter your phone or email to receive a verification code</li>
  </ul>
  <div class="max-w-[250px] m-auto">
    <img
      src="/img/instructions/how-do-you-want-to-log-in.jpg"
      class="border border-black"
      alt="A screenshot of the data linking screen, with a red arrow pointing at the 'Phone Number' button."
    />
  </div>
  <ul>
    <li>Verify your identity. You may receive texts, emails, or notifications from Uber/Lyft.</li>
    <li>
      Click “<strong>Continue with System</strong>” or “<strong>Link More Accounts</strong>”
    </li>
  </ul>
  <div class="max-w-[250px] m-auto">
    <img
      src="/img/instructions/your-uber-account-is-connected.png"
      class="border border-black"
      alt="A screenshot with text 'Your Uber account is connected' with a red arrow pointing at a 'Continue to System button'."
    />
  </div>
  <ul>
    <li>
      You may receive a text message from 855-542-0614 in a few minutes or a few hours. You can
      close System. 🙂
    </li>
  </ul>
  <p class="text-center my-4">
    <a href="/driver/org" class="btn btn-neutral"> Join Our Study </a>
  </p>

  <p>
    Questions? Problems? Requests? We’d love to help – please email us at <a
      href="mailto:theorganization@university.edu">theorganization@university.edu</a
    >.
  </p>
  <BreadCrumb returnUrl="/driver/landing" text="← Return to signup page" />
</div>
