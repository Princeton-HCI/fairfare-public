<script lang="ts">
  import { toast } from '@src/lib/toasts';

  import UseToast from '@src/lib/components/UseToast.svelte';
  import Modal from '@src/lib/components/Modal.svelte';
  import Input from '@src/lib/components/Input.svelte';

  import { title } from '@src/lib/stores/pageinfo';

  title.set('Storybook [Development]');

  // Define the colors array with their properties
  const colors = [
    { name: 'black', textClass: 'text-black', bgClass: 'bg-black', labelBg: 'bg-white' },
    { name: 'white', textClass: 'text-white', bgClass: 'bg-white', labelBg: 'bg-black' },
    { name: 'base-100', textClass: 'text-base-100', bgClass: 'bg-base-100', labelBg: 'bg-black' },
    {
      name: 'primary',
      textClass: 'text-primary',
      bgClass: 'bg-primary',
      labelBg: 'bg-black'
    },
    {
      name: 'secondary',
      textClass: 'text-secondary',
      bgClass: 'bg-secondary',
      labelBg: 'bg-black'
    },
    { name: 'neutral', textClass: 'text-neutral', bgClass: 'bg-neutral', labelBg: 'bg-white' },
    { name: 'error', textClass: 'text-error', bgClass: 'bg-error', labelBg: 'bg-white' },
    { name: 'accent', textClass: 'text-accent', bgClass: 'bg-accent', labelBg: 'bg-white' }
  ];
</script>

<UseToast />
<div class="prose mt-8 mb-4 mx-2">
  <h1>This is a "storybook" for design components for the System design system.</h1>

  <h2>General approaches and notes</h2>
  <ol>
    <li>
      Aim to eliminate custom css: first look at the <a
        href="https://daisyui.com/components/button/"
      >
        Daisy UI component library</a
      > for what you need.
    </li>
    <li>
      Avoid custom typography adjustments. Use headers and semantic elements as much as possible. By
      default, text should be wrapped in the <code>prose</code> class, provided by
      <a href="https://github.com/tailwindlabs/tailwindcss-typography">Tailwind typography</a>.
    </li>
    <li>
      If what you need exists, use that class and add an override as needed in <code>app.css</code>.
      This will make this usable out-of-the box for the next time.
    </li>
    <li>
      Use <a href="https://tabler.io/icons">Tabler Icons</a> for iconography.
    </li>
  </ol>
  <p>
    Note that this is based on Daisy UI, which is a Tailwind CSS component library.
    <a href="https://daisyui.com/components/button/">See more about Daisy UI here.</a>
  </p>

  <p>
    Also note that overrides exist for some of the Daisy components in
    <code>app.css</code>.
  </p>

  <h2>Colors</h2>

  <div class="flex flex-row gap-4">
    {#each colors.slice(0, 4) as { name, textClass, bgClass, labelBg }}
      <div class={textClass}>
        <div class="h-8 w-8 outline outline-black outline-1 {bgClass}"></div>
        <span class={labelBg}>{name}</span>
      </div>
    {/each}
  </div>
  <div class="flex flex-row gap-4 mt-3">
    {#each colors.slice(4) as { name, textClass, bgClass, labelBg }}
      <div class={textClass}>
        <div class="h-8 w-8 outline outline-black outline-1 {bgClass}"></div>
        <span class={labelBg}>{name}</span>
      </div>
    {/each}
  </div>

  <h2>Buttons</h2>

  <button class="btn">Default Button</button>
  <button class="btn btn-neutral">Neutral Button</button>
  <br />
  <div class="h-4"></div>
  <button class="btn btn-neutral" disabled>Disabled Neutral Button</button>
  <button class="btn btn-ghost">Ghost Button</button>
  <button class="btn btn-error">Error Button</button>

  <h2>Forms</h2>

  <label class="label-text" for="textarea"> Textarea label </label>
  <textarea
    class="textarea textarea-bordered border-black w-full"
    placeholder="Placeholder text"
    name="textarea"
  ></textarea>

  <Input label="Input label" bottomLabel="Helper text" name="input" />

  <h2>Toasts</h2>

  <button
    class="btn btn-neutral mt-4"
    onclick={() => toast({ text: 'This is a success toast.', type: 'success' })}
  >
    Show Success Toast
  </button>

  <button
    class="btn btn-error mt-4"
    onclick={() => toast({ text: 'This is a error toast.', type: 'error' })}
  >
    Show Error Toast
  </button>

  <button
    class="btn btn-neutral mt-4"
    onclick={() => toast({ text: 'This is a info toast.', type: 'info' })}
  >
    Show Info Toast
  </button>

  <h2>Modals</h2>

  <Modal buttonClass="btn" title="Test modal" id="test-modal">
    {#snippet buttonContent()}
      Open a modal
    {/snippet}
    {#snippet dialogContent()}
      <div class="prose">
        <p>
          Lorem ipsum dolor sit amet consectetur adipisicing elit. Corrupti necessitatibus
          veritatis, vel quae consectetur fuga libero, saepe doloribus quisquam, esse optio
          consequatur mollitia natus nobis labore iure fugit velit eligendi.
        </p>

        <button
          class="btn btn-error"
          onclick={() => toast({ text: 'This is a error toast.', type: 'error' })}
        >
          Show Error Toast
        </button>
      </div>
    {/snippet}
  </Modal>
  <h2>Typography</h2>

  <h1>Heading 1</h1>
  <h2>Heading 2</h2>
  <h3>Heading 3</h3>
  <h4>Heading 4</h4>
  <h5>Heading 5</h5>
  <h6>Heading 6</h6>

  <p>
    This is a paragraph of text. It should be easy to read and have a good line height. The font
    size should be appropriate for the content.
  </p>

  <h3>Lists</h3>

  An unordered list:
  <ul>
    <li>Item 1</li>
    <li>Item 2</li>
    <li>Item 3</li>
  </ul>

  An ordered list:
  <ol>
    <li>Item 1</li>
    <li>Item 2</li>
    <li>Item 3</li>
  </ol>
</div>
