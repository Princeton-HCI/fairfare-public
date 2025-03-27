<script lang="ts">
  interface Props {
    orientation?: 'horizontal' | 'vertical';
    children: import('svelte').Snippet;
  }

  let { orientation = 'horizontal', children }: Props = $props();

  // Note: the 'bottom-drawer' class is a custom class that we use in app.css
  // to make btn-ghost appear as btn-outline when the drawer is inline
  // e.g., on large viewports.
  let containerClasses = $state(
    'bottom-drawer fixed bottom-0 left-0 w-full bg-white p-4 flex justify-between shadow-top md:relative md:w-auto md:shadow-none md:p-0 md:flex-col-reverse md:gap-8 md:max-w-prose md:mt-4 md:bg-transparent'
  );

  if (orientation === 'vertical') {
    containerClasses += ' flex-col gap-2';
  } else {
    containerClasses += ' flex-row justify-between ';
  }
</script>

<div class={containerClasses}>
  {@render children()}
</div>
