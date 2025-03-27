// See https://kit.svelte.dev/docs/types#app
// for information about these interfaces
// and what to do when importing types
type Profile = SupabaseRows['profiles'];

declare namespace App {
  interface Locals {
    supabase: import('@supabase/supabase-js').SupabaseClient;
    safeGetSession: () => Promise<{
      session: import('@supabase/supabase-js').Session | null;
      user: import('@supabase/supabase-js').User | null;
      profile: Profile | null;
    }>;
  }
  // interface Error {}
  // interface Platform {}

  // injecting supabase types as detailed here:
  // https://supabase.com/docs/guides/auth/auth-helpers/sveltekit#typings
  interface Supabase {
    Database: import('./lib/schema').Database;
    SchemaName: 'public';
  }
  interface PageData {
    session: import('@supabase/supabase-js').Session | null;
  }
}
