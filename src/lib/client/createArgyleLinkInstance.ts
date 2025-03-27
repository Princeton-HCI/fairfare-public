import { PUB_ARGYLE_LINK_URL } from '$env/static/public';
import { argyleAccounts } from '@src/lib/stores/argyleAccounts';
import { toast } from '@src/lib/toasts';
import { supabase } from '@src/lib/client/db';

import type { ArgyleAccountData } from '@src/lib/types';
import { isDemoMode } from '../utils';
import { userDemoPhoneNumber } from '../stores/userDemoPhoneNumber';

const DEFAULT_ARGYLE_FLOW_ID = 'QM3BSPT2';

const handleAccountConnection = async (argyleAccountData: ArgyleAccountData) => {
  /**
   * When the user connects their account, we want to update the database
   * with the new account, linking the user to this new account.
   */
  const { accountId: argyleAccountId, userId: argyleUserId } = argyleAccountData;

  try {
    argyleAccounts.setFromArgyleLinkData(argyleAccountData);
    toast({ text: 'Account connected successfully', type: 'success' });

    const {
      data: { user }
    } = await supabase.auth.getUser();
    if (!user) throw new Error('No user found');

    const { error: newAccountError } = await supabase.from('argyle_accounts').upsert(
      {
        argyle_user: argyleUserId,
        argyle_account: argyleAccountId,
        user_id: user.id
      },
      {
        onConflict: 'argyle_user, argyle_account',
        ignoreDuplicates: true
      }
    );

    if (newAccountError) throw newAccountError;
  } catch (error) {
    console.error('Account connection error:', error);
    toast({ text: 'Error adding new account', type: 'error' });
  }

  // If this is on demo mode, then we'll want to send the demo SMS messages
  if (isDemoMode) {
    await userDemoPhoneNumber.sendDemoSMSMessages();
  }
};

const refreshArgyleToken = async (updateToken: (token: string) => void) => {
  try {
    const response = await fetch('/api/driver/argyle/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });

    const { token } = await response.json();
    argyleAccounts.setToken(token);
    updateToken(token);
  } catch (error) {
    toast({ text: 'Error getting new token', type: 'error' });
    console.error(error);
  }
};

/**
 * This makes an Argyle link instance.
 *
 * @param argyleLinkIds These are the IDs for the Argyle link items that should be shown to the user.
 * @param userToken The Argyle user token for the user to connect their account.
 * @param onClose The behavior to run when the Argyle link is closed.
 */
const createArgyleLinkInstance = (
  argyleLinkIds: string[],
  userToken: string,
  onClose: () => void
) => {
  return window.Argyle.create({
    apiHost: PUB_ARGYLE_LINK_URL,
    userToken: userToken,
    flowId: DEFAULT_ARGYLE_FLOW_ID, // optional
    items: argyleLinkIds.length === 0 ? undefined : argyleLinkIds,
    onAccountConnected: handleAccountConnection,
    onAccountError: (data: ArgyleAccountData) => console.log('Account error:', data),
    onClose: onClose,
    onTokenExpired: refreshArgyleToken
  });
};

export default createArgyleLinkInstance;
