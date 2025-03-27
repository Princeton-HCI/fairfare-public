<script lang="ts">
  import { _ } from 'svelte-i18n';
</script>

<section class="prose leading-snug bg-offwhite">
  <div class="flex justify-center">
    <a href="/">
      <img
        src="https://placehold.co/32"
        class="max-h-20"
        alt={$_('home.stylized-f-inside-of-a-circle-the-system-logo')}
      />
    </a>
  </div>
  <div class="flex justify-center">
    <div class="max-w-2xl mx-auto mt-8 p-4">
      <h1 class="text-3xl font-bold mb-4">Privacy Policy</h1>

      <p>
        This Privacy Policy describes how your personal information is collected, used, and shared
        when you visit or make a purchase from system.org or use the System app and website (the
        “App”).
      </p>

      <h2 class="text-xl font-semibold mt-4 mb-2">PERSONAL INFORMATION WE COLLECT</h2>

      <p>
        When you visit the App, we automatically collect certain information about your device,
        including information about your web browser, IP address, time zone, and some of the cookies
        that are installed on your device, none of which is linked to your identity. We refer to
        this automatically-collected information as “Device Information.”
      </p>

      <p>We collect other information in the following ways:</p>

      <ul class="list-disc ml-6">
        <li>
          Your gig work history data, if you link any gig accounts to us using <a
            href="https://argyle.com">Argyle</a
          >. This data includes details about jobs you've worked with gig companies, like your pay,
          tips, job location, and other information.
        </li>
        <li>
          Your contact information, such as your phone number and email, if you link any gig
          accounts using Argyle. This contact information is the same information you provided with
          any gig companies that you link. For example, if Uber has your phone number, and you link
          your Uber account to the App, we collect your phone number.
        </li>
        <li>Survey questionnaire data you answer and submit to the App</li>
      </ul>

      <p>
        When we talk about “Personal Information” in this Privacy Policy, we are talking both about
        Device Information and the information listed above.
      </p>

      <h2 class="text-xl font-semibold mt-4 mb-2">HOW DO WE USE YOUR PERSONAL INFORMATION?</h2>

      <p>
        We use this information to provide the services rendered in the App, namely, statistics on
        your pay and work history from accounts you link to the App.
      </p>

      <p>
        We also use this information, with your consent, to produce research content about those
        using the app <em>in aggregate</em>. For more details on research use, see the consent pages
        of the app.
      </p>

      <p>
        We do not share your personal information with any third parties except for other
        researchers or organizing groups that you explicitly consent to, and to comply with
        applicable laws and regulations.
      </p>

      <h2 class="text-xl font-semibold mt-4 mb-2">DATA RETENTION</h2>

      <p>
        If you opt-out of the study, all data we have collected attached to your identity is
        deleted.
      </p>

      <h2 class="text-xl font-semibold mt-4 mb-2">MINORS</h2>

      <p>The App is not intended for individuals under the age of 18.</p>

      <h2 class="text-xl font-semibold mt-4 mb-2">CHANGES</h2>

      <p>
        We may update this privacy policy from time to time in order to reflect, for example,
        changes to our practices or for other operational, legal, or regulatory reasons.
      </p>

      <h2 class="text-xl font-semibold mt-4 mb-2">CONTACT US</h2>

      <p>
        For more information about our privacy practices, if you have questions, or if you would
        like to make a complaint, please contact us by e-mail at <a
          href="mailto:organization@university.edu">organization@university.edu</a
        >
        or by mail using the details provided below:
      </p>

      <address class="text-gray-600">
        Name Name<br />
        Address Address<br />
        Address Address<br />
        University University<br />
      </address>
    </div>
  </div>
</section>
