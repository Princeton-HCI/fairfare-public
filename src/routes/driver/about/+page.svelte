<script>
  import FeedbackLink from '@src/lib/components/FeedbackLink.svelte';
  import { title } from '@src/lib/stores/pageinfo';

  import { _ } from 'svelte-i18n';

  title.set($_('driver.about.about') + ' System');
</script>

<div class="prose">
  <h1>{$_('driver.about.about')} <span class="font-bold">System</span></h1>
  <p>
    {$_(
      'driver.about.system-is-currently-in-beta-we-are-working-to-add-more-features-and-improve-the-user-experience-if-you-have-any-questions-or-feedback-please'
    )}
    <FeedbackLink />
  </p>
  <p>
    {$_(
      'driver.about.system-is-a-tool-to-analyze-fare-take-rates-and-study-ridehail-fairness-it-is-part-of-a-co-research-project-motivated-by-several-questions-that-drivers-and-researchers-are-trying-to-answer-including'
    )}
  </p>
  <ul>
    <li>{$_('driver.about.how-do-take-rates-vary-across-platforms-and-over-time')}</li>
    <li>
      {$_(
        'driver.about.do-platform-take-rates-vary-by-driver-experience-location-or-other-systemic-or-behavioral-factors'
      )}
    </li>
    <li>
      {$_('driver.about.are-platform-cuts-fair-how-do-driver-and-rider-ideas-of-fairness-differ')}
    </li>
    <li>
      {$_('driver.about.how-accurate-are-driver-and-riders-estimates-of-platform-take-rates')}
    </li>
    <li>{$_('driver.about.what-factors-do-drivers-see-as-important-to-change-about-fare-take')}</li>
  </ul>
  <p>
    {$_('driver.about.the-team-behind-system-includes-drivers-organizing-with')}
    <a href="https://crouton.net">
      {$_('driver.about.pelq-pelq')}
    </a>
    {$_('driver.about.and')}
    <a href="https://crouton.net">{$_('driver.about.gls-gls')}</a>
    {$_('driver.about.and-researchers-at-the')}
    <a href="https://university.edu/organization"> {$_('driver.about.organization')}</a>{$_(
      'driver.about.a-project-by-mit-and-university-with-funding-from-the-mozilla-foundation'
    )}
  </p>
  <p>
    {$_(
      'driver.about.together-were-crowdsourcing-fare-data-to-help-drivers-make-informed-decisions-about-their-work-and-to-advocate-for-better-working-conditions'
    )}
  </p>
</div>
