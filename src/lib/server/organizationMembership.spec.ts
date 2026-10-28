import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { sendOrganizerAccountCreatedAlert } from '@src/lib/email';
import {
  MAX_ALERT_DELIVERY_ATTEMPTS,
  processOrganizerMembershipAlerts
} from './organizerMembershipAlerts';

vi.mock('@src/lib/email', () => ({ sendOrganizerAccountCreatedAlert: vi.fn() }));

const event = {
  id: 'event-1',
  claim_token: 'lease-1',
  phone: '15555550123',
  organization_key: 'du',
  role: 'lead_organizer',
  source: 'team',
  attempts: 1
};
function database(events = [event]) {
  const query = { eq: vi.fn(), update: vi.fn() };
  query.eq.mockReturnValue(query);
  // Supabase builders are thenable; a plain result on the second eq is sufficient here.
  query.eq
    .mockImplementationOnce(() => query)
    .mockImplementationOnce(() => Promise.resolve({ error: null }));
  query.update.mockReturnValue(query);
  const rpc = vi.fn().mockResolvedValue({ data: events, error: null });
  const from = vi.fn().mockReturnValue(query);
  return { client: { rpc, from } as unknown as SupabaseClient, rpc, query };
}

describe('durable organizer membership alerts', () => {
  beforeEach(() => {
    vi.stubEnv('ORGANIZER_ALERT_EMAILS', 'operator@example.test');
    vi.mocked(sendOrganizerAccountCreatedAlert).mockReset().mockResolvedValue(undefined);
  });
  afterEach(() => vi.unstubAllEnvs());

  it('sends the event role and source, and acknowledges only its current lease', async () => {
    const db = database();
    expect(await processOrganizerMembershipAlerts(db.client)).toEqual({
      sent: 1,
      failed: 0,
      abandoned: 0
    });
    expect(sendOrganizerAccountCreatedAlert).toHaveBeenCalledWith({
      phone: event.phone,
      organizationKey: 'du',
      role: 'Organizer administrator',
      source: 'team'
    });
    expect(db.query.update).toHaveBeenCalledWith(
      expect.objectContaining({ sent_at: expect.any(String), claim_token: null })
    );
    expect(db.query.eq).toHaveBeenCalledWith('claim_token', 'lease-1');
  });

  it('leaves failures queued for retry rather than acknowledging delivery', async () => {
    vi.mocked(sendOrganizerAccountCreatedAlert).mockRejectedValue(new Error('SMTP unavailable'));
    const db = database();
    expect(await processOrganizerMembershipAlerts(db.client)).toEqual({
      sent: 0,
      failed: 1,
      abandoned: 0
    });
    expect(db.query.update).toHaveBeenCalledWith({
      available_at: expect.any(String),
      claim_token: null,
      last_error: 'Email delivery failed'
    });
  });

  it('abandons an event that still fails on its last allowed attempt', async () => {
    vi.mocked(sendOrganizerAccountCreatedAlert).mockRejectedValue(new Error('SMTP unavailable'));
    const db = database([{ ...event, attempts: MAX_ALERT_DELIVERY_ATTEMPTS }]);
    expect(await processOrganizerMembershipAlerts(db.client)).toEqual({
      sent: 0,
      failed: 0,
      abandoned: 1
    });
    expect(db.query.update).toHaveBeenCalledWith({
      abandoned_at: expect.any(String),
      claim_token: null,
      last_error: `Email delivery failed; abandoned after ${MAX_ALERT_DELIVERY_ATTEMPTS} attempts`
    });
    expect(db.query.eq).toHaveBeenCalledWith('claim_token', 'lease-1');
  });

  it('reports alerts as disabled, without claiming or discarding jobs, when recipients are missing', async () => {
    vi.stubEnv('ORGANIZER_ALERT_EMAILS', ' , ');
    const db = database();
    expect(await processOrganizerMembershipAlerts(db.client)).toEqual({
      sent: 0,
      failed: 0,
      abandoned: 0,
      disabled: true
    });
    expect(db.rpc).not.toHaveBeenCalled();
    expect(sendOrganizerAccountCreatedAlert).not.toHaveBeenCalled();
  });

  it('does not send anything when there are no due events', async () => {
    const db = database([]);
    expect(await processOrganizerMembershipAlerts(db.client)).toEqual({
      sent: 0,
      failed: 0,
      abandoned: 0
    });
    expect(sendOrganizerAccountCreatedAlert).not.toHaveBeenCalled();
  });
});
