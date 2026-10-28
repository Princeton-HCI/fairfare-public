<script lang="ts">
  import AdminNav from '@src/lib/components/admin/AdminNav.svelte';
  import UseToast from '@src/lib/components/UseToast.svelte';

  interface Props {
    children: import('svelte').Snippet;
  }

  let { children }: Props = $props();
</script>

<UseToast />
<div class="admin-dash flex h-screen bg-base-100 w-screen">
  <AdminNav />
  <main class="flex-1 overflow-y-auto pt-20 lg:pt-8 px-6 lg:px-10 pb-8">
    {@render children()}
  </main>
</div>
