import { supabase } from './db';
import { toast } from '../toasts';

export default async function logOut(redirectTo = '/') {
  try {
    await supabase.auth.signOut();

    // Clear sessionStorage to prevent the next user from inheriting
    // the previous user's affiliation state
    window.sessionStorage.removeItem('affiliations');
    window.sessionStorage.removeItem('dataSharingConsents');
    window.sessionStorage.removeItem('argyleAccounts');

    toast({
      text: 'Successfully logged out',
      type: 'success'
    });
    window.location.href = redirectTo;
  } catch (error) {
    console.error('Logging out failed');
    console.error(error);
    toast({
      text: 'Error logging out',
      type: 'error'
    });
  }
}
