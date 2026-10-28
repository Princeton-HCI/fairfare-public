import { supabase } from '@src/lib/server/db';
import { expect, vi } from 'vitest';

import handlePostSync from './handlePostSync';
import {
  createTestUserByEmail,
  teardownTestUserByUserId,
  uniqueTestEmail
} from '@tests/utils/testUser';
import { updateProfileByUserId } from '@src/lib/databaseHelpers';
import * as sendThankYouMessageToArgyleUser from './sendThankYouMessageToArgyleUser';
import * as sendTakeRateMessageIfElegibleToArgyleUser from './sendTakeRateMessageIfElegibleToArgyleUser';

const HANDLE_POST_SYNC_NO_STUDY_PARTICIPATIONS_EMAIL = uniqueTestEmail(
  'handle-post-sync-no-study-participations'
);

describe('user does not exist', () => {
  it('sends no messages', async () => {
    vi.spyOn(
      sendTakeRateMessageIfElegibleToArgyleUser,
      'sendTakeRateMessageIfElegibleToArgyleUser'
    ).mockResolvedValueOnce(void 'abc');

    vi.spyOn(
      sendThankYouMessageToArgyleUser,
      'sendThankYouMessageToArgyleUser'
    ).mockResolvedValueOnce(void 'abc');

    await handlePostSync('abcd1234-abcd-abcd-abcd-555662341234');

    // expect neither function to have been called
    expect(
      sendTakeRateMessageIfElegibleToArgyleUser.sendTakeRateMessageIfElegibleToArgyleUser
    ).not.toHaveBeenCalled();
    expect(sendThankYouMessageToArgyleUser.sendThankYouMessageToArgyleUser).not.toHaveBeenCalled();
  });
});
describe('user has no study_participations or profile', () => {
  it('sends the take rate sms', async () => {
    // make a test user
    const user = await createTestUserByEmail(HANDLE_POST_SYNC_NO_STUDY_PARTICIPATIONS_EMAIL);

    await updateProfileByUserId(supabase, user.id, {
      argyle_user: '88882222-abcd-abcd-abcd-123412341234'
    });

    vi.spyOn(
      sendTakeRateMessageIfElegibleToArgyleUser,
      'sendTakeRateMessageIfElegibleToArgyleUser'
    ).mockResolvedValueOnce(void 'abc');

    await handlePostSync('88882222-abcd-abcd-abcd-123412341234');

    // expect the sendTakeRateMessageIfElegibleToArgyleUser function to have been called
    expect(
      sendTakeRateMessageIfElegibleToArgyleUser.sendTakeRateMessageIfElegibleToArgyleUser
    ).toHaveBeenCalledOnce();
    expect(
      sendTakeRateMessageIfElegibleToArgyleUser.sendTakeRateMessageIfElegibleToArgyleUser
    ).toHaveBeenCalledWith('88882222-abcd-abcd-abcd-123412341234');

    // clean up
    await teardownTestUserByUserId(user.id);
  });
});
// See ENG-344 -- we've disabled all studies, so this test is now skipped.
// If / when we re-enable studies, we should re-enable this test with the new
// study_shortcode_type enum values instead of 'edl'.
describe.skip('user has one study_participation with send-thank-you post_sync', () => {
  it('sends the thank you sms', async () => {
    // make a test user
    const user = await createTestUserByEmail(HANDLE_POST_SYNC_NO_STUDY_PARTICIPATIONS_EMAIL);

    await updateProfileByUserId(supabase, user.id, {
      argyle_user: 'abcdabcd-abcd-abcd-abcd-123412341234',
      phone: '1234567890'
    });

    const { error: upsertError } = await supabase.from('study_participations').upsert(
      {
        user_id: user.id,
        study_shortcode: 'edl',
        survey_response_id: 'test-survey-response-id-eg-from-qualtrics',
        post_sync: 'send-thank-you'
      },
      {
        onConflict: 'user_id, study_shortcode'
      }
    );
    expect(upsertError).toBeNull();
    vi.spyOn(
      sendThankYouMessageToArgyleUser,
      'sendThankYouMessageToArgyleUser'
    ).mockResolvedValueOnce(void 'abc');

    await handlePostSync('abcdabcd-abcd-abcd-abcd-123412341234');

    // expect the sendThankYouMessageToArgyleUser function to have been called
    expect(sendThankYouMessageToArgyleUser.sendThankYouMessageToArgyleUser).toHaveBeenCalledOnce();
    expect(sendThankYouMessageToArgyleUser.sendThankYouMessageToArgyleUser).toHaveBeenCalledWith(
      'abcdabcd-abcd-abcd-abcd-123412341234'
    );

    // clean up
    await teardownTestUserByUserId(user.id);
  });
});
// See ENG-344 -- we've disabled all studies, so this test is now skipped.
// If / when we re-enable studies, we should re-enable this test with the new
// study_shortcode_type enum values instead of 'edl'.
describe.skip('user has two study_participations, a newer one with do-nothing post_sync and an older one with send-thank-you post_sync', () => {
  it('does nothing', async () => {
    // make a test user
    const user = await createTestUserByEmail(
      uniqueTestEmail('handle-post-sync-multiple-participations')
    );

    await updateProfileByUserId(supabase, user.id, {
      argyle_user: 'dddababa-abcd-abcd-abcd-123412341234',
      phone: '1234567891'
    });

    // Insert older study participation with send-thank-you
    const { error: firstUpsertError } = await supabase.from('study_participations').upsert(
      {
        user_id: user.id,
        study_shortcode: 'edl',
        survey_response_id: 'test-survey-response-id-1',
        post_sync: 'send-thank-you',
        created_at: new Date('2024-01-01').toISOString()
      },
      {
        onConflict: 'user_id, study_shortcode'
      }
    );
    expect(firstUpsertError).toBeNull();

    // Insert newer study participation with do-nothing
    const { error: secondUpsertError } = await supabase.from('study_participations').upsert(
      {
        user_id: user.id,
        study_shortcode: 'edl',
        survey_response_id: 'test-survey-response-id-2',
        post_sync: 'do-nothing',
        created_at: new Date('2024-01-02').toISOString()
      },
      {
        onConflict: 'user_id, study_shortcode'
      }
    );
    expect(secondUpsertError).toBeNull();

    // set up spies for both possible actions
    vi.spyOn(
      sendThankYouMessageToArgyleUser,
      'sendThankYouMessageToArgyleUser'
    ).mockResolvedValueOnce(void 'abc');

    vi.spyOn(
      sendTakeRateMessageIfElegibleToArgyleUser,
      'sendTakeRateMessageIfElegibleToArgyleUser'
    ).mockResolvedValueOnce(void 'abc');

    await handlePostSync('dddababa-abcd-abcd-abcd-123412341234');

    // verify that neither action was called since the newest participation has do-nothing
    expect(sendThankYouMessageToArgyleUser.sendThankYouMessageToArgyleUser).not.toHaveBeenCalled();
    expect(
      sendTakeRateMessageIfElegibleToArgyleUser.sendTakeRateMessageIfElegibleToArgyleUser
    ).not.toHaveBeenCalled();

    // clean up
    await teardownTestUserByUserId(user.id);
  });
});
