import { writable, get } from 'svelte/store';
import { supabase } from '@src/lib/client/db';

type AffiliateOrganization = SupabaseInserts['affiliate_organizations'];

// All active affiliate organizations, loaded from the database.
export const allAffiliations = writable<AffiliateOrganization[]>([]);

let _loadPromise: Promise<void> | null = null;

/** Fetch all active affiliate organizations from the database. Safe to call multiple times. */
export async function loadAllAffiliations(): Promise<void> {
  if (_loadPromise) return _loadPromise;

  _loadPromise = (async () => {
    if (get(allAffiliations).length > 0) return;

    const { data, error } = await supabase
      .from('affiliate_organizations')
      .select('id, key, name, url, status')
      .eq('status', 'active')
      .order('name');

    if (error) {
      console.error('Error fetching affiliate organizations:', error);
      _loadPromise = null;
      return;
    }

    allAffiliations.set(data ?? []);
  })();

  return _loadPromise;
}

export type Affiliations = {
  primary: undefined | AffiliateOrganization;
  secondaryOrgs: AffiliateOrganization[];
  /** @deprecated Use `primary`. */
  selected: undefined | AffiliateOrganization;
  selectedAffiliationsAreLoadedFromDatabase: boolean;
};

const defaultAffiliations: Affiliations = {
  primary: undefined,
  secondaryOrgs: [],
  selected: undefined,
  selectedAffiliationsAreLoadedFromDatabase: false
};

function createAffiliations() {
  const { subscribe, set, update } = writable<Affiliations>(defaultAffiliations);
  return {
    subscribe,
    set,
    update,
    reset: () => set(defaultAffiliations),
    getSelectedAffiliationsFromDatabase: async () => {
      const {
        data: { user }
      } = await supabase.auth.getUser();
      const userId = user?.id;
      if (!userId) return console.error('No user ID found');

      const { data, error } = await supabase
        .from('driver_affiliate_organization_affiliations')
        .select(
          'is_primary, affiliate_organizations(id, key, name, url, created_at, updated_at, status)'
        )
        .eq('user_id', userId);

      if (error) {
        console.error('Error fetching affiliations:', error);
        return;
      }

      type Row = {
        is_primary: boolean | null;
        affiliate_organizations: AffiliateOrganization | null;
      };

      const rows = (data ?? []) as unknown as Row[];

      const primaryRow = rows.find((r) => r.is_primary === true);
      const secondaryRows = rows.filter((r) => r.is_primary !== true);

      const primary = primaryRow?.affiliate_organizations ?? undefined;
      const secondaryOrgs = secondaryRows
        .map((r) => r.affiliate_organizations)
        .filter((a): a is AffiliateOrganization => a !== null);

      update((state) => ({
        ...state,
        primary,
        secondaryOrgs,
        selected: primary,
        selectedAffiliationsAreLoadedFromDatabase: true
      }));
    },
    toggleSelection: (affiliation: AffiliateOrganization) => {
      update((state) => ({
        ...state,
        selected: affiliation
      }));
    },
    /** @deprecated Prefer `/api/driver/affiliate-primary` or `/api/driver/affiliate-secondary`. */
    updateDatabase: async () => {
      const {
        data: { user }
      } = await supabase.auth.getUser();
      const userId = user?.id;
      if (!userId) return console.error('No user ID found');

      let newSelectedAffiliationKey: string | undefined;
      update((state) => {
        newSelectedAffiliationKey = state.selected?.key;
        return state;
      });

      const { data: affiliateOrganizationsWithIds, error: affiliateOrganizationsError } =
        await supabase
          .from('affiliate_organizations')
          .select('id')
          .eq('key', newSelectedAffiliationKey);
      if (affiliateOrganizationsError) {
        console.error('Error fetching affiliation IDs:', affiliateOrganizationsError);
        throw affiliateOrganizationsError;
      }
      const newSelectedAffiliationIds = affiliateOrganizationsWithIds.map(
        (affiliateOrganization) => affiliateOrganization.id
      );

      const { error: deleteError } = await supabase
        .from('driver_affiliate_organization_affiliations')
        .delete()
        .eq('user_id', userId)
        .eq('is_primary', true);

      if (deleteError) {
        console.error('Error deleting primary affiliation:', deleteError);
        throw deleteError;
      }

      const newPrimary = newSelectedAffiliationIds.map((affiliationId) => ({
        user_id: userId as string,
        affiliate_organization_id: affiliationId,
        is_primary: true
      }));

      const { error: insertError } = await supabase
        .from('driver_affiliate_organization_affiliations')
        .insert(newPrimary);
      if (insertError) {
        console.error('Error inserting primary affiliation:', insertError);
        throw insertError;
      }

      console.log('primary affiliation written to database');
    }
  };
}

export const affiliations = createAffiliations();
