import { writable } from 'svelte/store';
import { supabase } from '@src/lib/client/db';

// Tracks the user's consent to share data with each affiliation
// The key is the affiliation key, and the value is a boolean indicating whether the user has consented
// we do this instead of just tracking keys in case we want to make consent more granular in the future.

type AffiliateOrganization = SupabaseInserts['affiliate_organizations'];

export type DataSharingConsents = {
  selected: AffiliateOrganization[];
  affiliateOrganizations: AffiliateOrganization[];
};

const defaultDataSharingConsents = {
  selected: [],
  affiliateOrganizations: []
};

function createDataSharingConsents() {
  const { subscribe, set, update } = writable<DataSharingConsents>(defaultDataSharingConsents);
  return {
    subscribe,
    set,
    update,
    reset: () => set(defaultDataSharingConsents),
    getSelectedDataSharingConsentsFromDatabase: async () => {
      // get the user ID
      const {
        data: { user }
      } = await supabase.auth.getUser();
      const userId = user?.id;
      if (!userId) throw new Error('No user ID found');

      const { data: affiliateOrganizationConsents, error } = await supabase
        .from('driver_affiliate_organization_data_sharing_consents')
        .select('affiliate_organizations(*)')
        .eq('user_id', userId);
      if (error) {
        throw new Error('Error fetching consents: ' + error);
      }
      // @ts-expect-error Type 'any[]' is missing the following properties from type '{ created_at?: string | undefined; id?: string | undefined; key: string; name: string; signup_code?: string | null | undefined; status?: "active" | "deleted" | undefined; updated_at?: string | undefined; url?: string | null | undefined; }': key, namets(2352)
      const flattenedAffiliateOrganizationConsents = affiliateOrganizationConsents
        .map((consent) => consent.affiliate_organizations)
        .filter((a) => a !== null) as AffiliateOrganization[];

      update((dataSharingConsents) => {
        return {
          ...dataSharingConsents,
          selected: flattenedAffiliateOrganizationConsents
        };
      });
    },
    setAffiliateOrganizations: (affiliateOrganizations: AffiliateOrganization[]) => {
      update((dataSharingConsents) => {
        return {
          ...dataSharingConsents,
          affiliateOrganizations
        };
      });
    },
    toggleSelection: (toggledkey: string) => {
      update((dataSharingConsents) => {
        const selectedAffiliationKeys = dataSharingConsents.selected.map((a) => a.key);
        const affiliationAlreadySelected = selectedAffiliationKeys.includes(toggledkey);
        const toggledDataSharingConsent = dataSharingConsents.affiliateOrganizations.find(
          (a) => a.key === toggledkey
        );
        if (!toggledDataSharingConsent) {
          throw new Error(`Affiliation with key ${toggledkey} not found`);
        }
        if (affiliationAlreadySelected) {
          return {
            ...dataSharingConsents,
            selected: dataSharingConsents.selected.filter((a) => a.key !== toggledkey)
          };
        } else {
          return {
            ...dataSharingConsents,
            selected: [...dataSharingConsents.selected, toggledDataSharingConsent]
          };
        }
      });
    },
    setConsent: (toggledKey: string, selected: boolean) => {
      update((dataSharingConsents) => {
        const toggledDataSharingConsent = dataSharingConsents.affiliateOrganizations.find(
          (a) => a.key === toggledKey
        );
        if (!toggledDataSharingConsent) {
          throw new Error(`Affiliation with key ${toggledKey} not found`);
        }
        if (selected) {
          return {
            ...dataSharingConsents,
            selected: [...dataSharingConsents.selected, toggledDataSharingConsent]
          };
        } else {
          return {
            ...dataSharingConsents,
            selected: dataSharingConsents.selected.filter((a) => a.key !== toggledKey)
          };
        }
      });
    },
    updateDatabase: async () => {
      /**
       * Updates the db with the new consents
       */
      // get the user ID
      const {
        data: { user }
      } = await supabase.auth.getUser();
      const userId = user?.id;
      if (!userId) throw new Error('No user ID found');

      let newSelectedConsentsKeys: string[] = [];
      update((dataSharingConsents) => {
        // get the consent ids
        newSelectedConsentsKeys = dataSharingConsents.selected.map((a) => a.key);
        return dataSharingConsents;
      });

      const { data: affiliateOrganizationsWithIds, error: affiliateOrganizationsError } =
        await supabase
          .from('affiliate_organizations')
          .select('id')
          .in('key', newSelectedConsentsKeys);
      if (affiliateOrganizationsError) {
        console.error('Error fetching affiliation IDs: ' + affiliateOrganizationsError);
        throw affiliateOrganizationsError;
      }
      const newConsentAffiliationIds = affiliateOrganizationsWithIds.map(
        (affiliateOrganization) => affiliateOrganization.id
      );
      const newAffiliations = newConsentAffiliationIds.map((affiliationId) => ({
        user_id: userId as string,
        affiliate_organization_id: affiliationId
      }));

      // the strategy here is to delete all consents for the user and then insert the new ones
      // this will have the possibility of deleting consents that were not
      // changed by the user, but it's the simplest way to handle this since
      // supabase does not currently have transaction support on the js client

      // delete all consents for the user
      const { error: deleteError } = await supabase
        .from('driver_affiliate_organization_data_sharing_consents')
        .delete()
        .eq('user_id', userId);

      if (deleteError) {
        console.error('Error deleting consents: ' + deleteError);
        throw deleteError;
      }

      // insert the new consents
      const { error: insertError } = await supabase
        .from('driver_affiliate_organization_data_sharing_consents')
        .insert(newAffiliations);
      if (insertError) {
        console.error('Error inserting consents: ' + insertError);
        throw insertError;
      }

      console.log('consents written to database');
    }
  };
}

export const dataSharingConsents = createDataSharingConsents();
