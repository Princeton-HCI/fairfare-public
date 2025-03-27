import { writable } from 'svelte/store';
import { supabase } from '@src/lib/client/db';

type AffiliateOrganization = SupabaseInserts['affiliate_organizations'];

// Although affiliations are stored in the affiliate_organization table,
// we also include them here to avoid hitting the db again.
// This represents the affiliate organizations that are not user created.
export const allAffiliations: AffiliateOrganization[] = [
  { name: 'PELQ', key: 'pelq', url: 'http://crouton.net' },
  {
    name: 'OPL',
    key: 'opl',
    url: 'http://crouton.net'
  },
  { name: 'EDL', key: 'edl', url: 'http://crouton.net' },
  { name: 'LPC', key: 'lpc', url: 'http://crouton.net' },
  { name: 'GLS', key: 'gls', url: 'http://crouton.net' }
];

export type Affiliations = {
  selected: undefined | AffiliateOrganization;
  selectedAffiliationsAreLoadedFromDatabase: boolean;
};

const defaultAffiliations = {
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
      // get the user ID
      const {
        data: { user }
      } = await supabase.auth.getUser();
      const userId = user?.id;
      if (!userId) return console.error('No user ID found');

      const { data: affiliations, error } = await supabase
        .from('driver_affiliate_organization_affiliations')
        .select('affiliate_organizations(*)')
        .eq('user_id', userId);
      if (error) {
        console.error('Error fetching affiliations:', error);
        return;
      }
      // @ts-expect-error Type 'any[]' is missing the following properties from type '{ created_at?: string | undefined; id?: string | undefined; key: string; name: string; signup_code?: string | null | undefined; status?: "active" | "deleted" | undefined; updated_at?: string | undefined; url?: string | null | undefined; }': key, namets(2352)
      const flattenedAffiliations = affiliations
        .map((affiliation) => affiliation.affiliate_organizations)
        .filter((a) => a !== null) as AffiliateOrganization[];

      update((affiliations) => {
        return {
          ...affiliations,
          selected: flattenedAffiliations[0],
          selectedAffiliationsAreLoadedFromDatabase: true
        };
      });
    },
    toggleSelection: (affiliation: AffiliateOrganization) => {
      update((affiliations) => {
        return {
          ...affiliations,
          selected: affiliation
        };
      });
    },
    updateDatabase: async () => {
      // get the user ID
      const {
        data: { user }
      } = await supabase.auth.getUser();
      const userId = user?.id;
      if (!userId) return console.error('No user ID found');

      let newSelectedAffiliationKey: string | undefined;
      update((affiliations) => {
        // get the affiliation keys
        newSelectedAffiliationKey = affiliations.selected?.key;
        return affiliations;
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

      const newSelectedAffiliations = newSelectedAffiliationIds.map((affiliationId) => ({
        user_id: userId as string,
        affiliate_organization_id: affiliationId
      }));

      // the strategy here is to delete all affiliations for the user and then insert the new ones
      // this will have the possibility of deleting affiliations that were not
      // changed by the user, but it's the simplest way to handle this since
      // supabase does not currently have transaction support on the js client

      // delete all affiliations for the user
      const { error: deleteError } = await supabase
        .from('driver_affiliate_organization_affiliations')
        .delete()
        .eq('user_id', userId);

      if (deleteError) {
        console.error('Error deleting affiliations:', deleteError);
        throw deleteError;
      }

      // insert the new affiliations
      const { error: insertError } = await supabase
        .from('driver_affiliate_organization_affiliations')
        .insert(newSelectedAffiliations);
      if (insertError) {
        console.error('Error inserting affiliations:', insertError);
        throw insertError;
      }

      console.log('affiliations written to database');
    }
  };
}

export const affiliations = createAffiliations();
