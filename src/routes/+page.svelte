<script lang="ts">
  import { title } from '@src/lib/stores/pageinfo';
  import { _ } from 'svelte-i18n';
  import LandingFooter from '@src/lib/components/layout/LandingFooter.svelte';
  import { toast } from '@src/lib/toasts';
  import UseToast from '@src/lib/components/UseToast.svelte';

  import Header from '@src/lib/components/layout/Header.svelte';

  title.set($_('home.get-system'));

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());

    try {
      const response = await fetch('https://formspree.io/f/your-form-id', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });

      if (response.ok) {
        toast({ text: 'Message sent successfully!', type: 'success' });
        form.reset();
      } else {
        toast({ text: 'Something went wrong. Please try again.', type: 'error' });
      }
    } catch (error) {
      toast({ text: 'Something went wrong. Please try again.', type: 'error' });
      console.error(error);
    }
  };
</script>

<UseToast />

<section class="bg-primary flex flex-col pb-12 md:pb-24">
  <Header />

  <div class="flex flex-col flex-1 items-center justify-center text-center px-4 mt-8 md:mt-12">
    <img src="/img/systemlogo.svg" alt="System Logo" class="w-48 h-auto mb-8 md:mb-12" />
    <h1 class="font-serif text-2xl mb-6 md:mb-4">
      {$_('home.maintext')}
    </h1>
    <p class="md:text-base mx-4 mb-6 md:mb-8">
      {$_('home.subtext')}
    </p>
    <a href="/driver" class="btn btn-neutral md:w-48">
      {$_('home.mainbutton')}
    </a>
  </div>
</section>

<section class="prose px-4 bg-base-100 w-full md:container md:max-w-none md:px-8">
  <div class="md:flex md:flex-row md:items-center md:gap-8">
    <div class="mt-12 mb-6 relative aspect-video w-full md:w-2/3 md:mt-16 md:mb-16">
      <iframe
        width="100%"
        height="100%"
        src="https://www.youtube.com/embed/your-video-id"
        title="main-video"
        frameborder="0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowfullscreen
        class="absolute top-0 left-0 w-full h-full"
      ></iframe>
    </div>
    <div class="md:w-2/5">
      <h2 class="text-2xl md:text-lg mt-0">{$_('home.section1.title')}</h2>
      <p class="text-lg md:text-sm mb-12 md:mb-0">{$_('home.section1.description')}</p>
    </div>
  </div>

  <div class="divider mb-12"></div>

  <h2 class="leading-normal text-4xl md:text-2xl text-center mb-8">
    {$_('home.section2.title')}
  </h2>

  <div class="md:flex md:flex-row-reverse md:items-center md:gap-16 mb-6">
    <div class="w-full aspect-square overflow-hidden md:w-1/2 md:aspect-auto mb-12 md:mb-0">
      <img
        src="/img/homepage-one.webp"
        alt="home-one"
        class="w-full h-full object-cover md:object-contain md:h-auto"
      />
    </div>
    <div class="md:w-1/2 md:pr-8">
      <h3 class="text-3xl md:text-xl mt-0 mb-4">{$_('home.section2.subsection1.title')}</h3>
      <p class="text-lg md:text-base mb-8">{$_('home.section2.subsection1.description')}</p>
    </div>
  </div>

  <div class="md:flex md:flex-row md:items-center md:gap-16 mb-6">
    <div class="w-full aspect-square overflow-hidden md:w-1/2 md:aspect-auto mb-12 md:mb-0">
      <img
        src="/img/homepage-two.webp"
        alt="home-two"
        class="w-full h-full object-cover md:object-contain md:h-auto"
      />
    </div>
    <div class="md:w-1/2 md:pr-8">
      <h3 class="text-3xl md:text-xl mt-0 mb-4">{$_('home.section2.subsection2.title')}</h3>
      <p class="text-lg md:text-base mb-8">{$_('home.section2.subsection2.description')}</p>
    </div>
  </div>

  <div class="md:flex md:flex-row-reverse md:items-center md:gap-16 mb-6">
    <div class="w-full aspect-square overflow-hidden md:w-1/2 md:aspect-auto mb-12 md:mb-0">
      <img
        src="/img/homepage-three.webp"
        alt="home-three"
        class="w-full h-full object-cover md:object-contain md:h-auto"
      />
    </div>
    <div class="md:w-1/2 md:pr-8">
      <h3 class="text-3xl md:text-xl mt-0 mb-4">{$_('home.section2.subsection3.title')}</h3>
      <p class="text-lg md:text-base mb-8">{$_('home.section2.subsection3.description')}</p>
    </div>
  </div>

  <div class="divider mb-12"></div>

  <div class="md:flex md:flex-row md:items-center md:gap-16 mb-6 md:mx-32">
    <img
      src="/img/form-image.webp"
      alt="form-illustration"
      class="w-full aspect-square overflow-hidden md:w-2/5 md:aspect-auto mb-12 md:mb-0 max-w-md"
    />
    <div class="md:pb-8">
      <h2 class="text-2xl mb-4">{$_('home.form.title')}</h2>
      <p class="text-base">{$_('home.form.description')}</p>

      <form id="contact-form" class="flex flex-col gap-4" onsubmit={handleSubmit}>
        <input
          required
          type="text"
          placeholder={$_('home.form.name')}
          aria-label={$_('home.form.name')}
          name="name"
          class="input input-bordered border-black w-full"
        />

        <input
          type="text"
          placeholder={$_('home.form.role')}
          aria-label={$_('home.form.role')}
          name="role"
          class="input input-bordered border-black w-full"
        />

        <input
          required
          type="email"
          placeholder={$_('home.form.email')}
          aria-label={$_('home.form.email')}
          name="email"
          class="input input-bordered border-black w-full"
        />

        <textarea
          class="textarea textarea-bordered border-black"
          style="height: 8rem;"
          placeholder={$_('home.form.message')}
          aria-label={$_('home.form.message')}
          name="message"
        ></textarea>

        <button type="submit" class="btn btn-neutral self-start mt-2">
          {$_('home.form.submit')}
        </button>
      </form>
    </div>
  </div>
</section>
<LandingFooter />

<style>
  :global(.input),
  :global(.textarea) {
    background-color: transparent !important;
  }
</style>
