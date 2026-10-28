"""RBAC database regressions against local Supabase (requires psql and migrations).

Run: RBAC_TEST_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres \
     python3 tests/rbac-database-regression.py
Only unique fixtures created by this run are removed; no global test-user cleanup.
No application/email worker is invoked.
"""
import os
import subprocess
import time
import unittest
import uuid
from urllib.parse import urlparse

DATABASE_URL = os.environ.get('RBAC_TEST_DATABASE_URL', '')
if urlparse(DATABASE_URL).hostname not in ('localhost', '127.0.0.1', '::1'):
    raise SystemExit('RBAC_TEST_DATABASE_URL must point to a local disposable test database')


def execute(sql, check=True):
    result = subprocess.run(['psql', DATABASE_URL, '-XqAt', '-v', 'ON_ERROR_STOP=1'],
                            input=sql, text=True, capture_output=True)
    if check and result.returncode:
        raise AssertionError(result.stderr)
    return result


class MembershipRegressions(unittest.TestCase):
    def setUp(self):
        self.org = str(uuid.uuid4())
        self.users = [str(uuid.uuid4()) for _ in range(5)]
        self.a, self.b, self.member, self.researcher, self.admin = self.users
        self.phones = ['1555' + str(uuid.uuid4().int % 10**7).zfill(7) for _ in self.users]
        self.addCleanup(self.cleanup)
        sql = f"INSERT INTO public.affiliate_organizations(id,key,name,url) VALUES ('{self.org}','ff48-{self.org}','RBAC regression','https://example.test');"
        for user, phone in zip(self.users, self.phones):
            sql += f"INSERT INTO auth.users(id,phone,email) VALUES ('{user}','{phone}','{user}@rbac.example.test');"
            role = {self.researcher: 'researcher', self.admin: 'admin'}.get(user, 'organizer')
            sql += f"INSERT INTO public.user_roles(user_id,role) VALUES ('{user}','{role}');"
        for user in (self.a, self.b):
            sql += f"INSERT INTO public.organization_members(user_id,organization_id,role) VALUES ('{user}','{self.org}','lead_organizer');"
        execute('BEGIN;' + sql + 'COMMIT;')

    def cleanup(self):
        users = ','.join(f"'{user}'" for user in self.users)
        # Delete the fixture organization first, allowing its intentional cascade.
        execute(f"DELETE FROM public.affiliate_organizations WHERE id='{self.org}';"
                f"DELETE FROM public.organizer_membership_alerts WHERE user_id IN ({users});"
                f"DELETE FROM auth.users WHERE id IN ({users});")

    def as_user(self, user, sql, check=True):
        return execute(f"BEGIN; SET LOCAL ROLE authenticated; SELECT set_config('request.jwt.claim.sub','{user}',true);"
                       + sql + ';COMMIT;', check)

    def as_service_role(self, sql, check=True):
        """Run `sql` the way the admin API reaches the database: PostgREST switches
        the connection to `service_role`, which is what the last-lead exemption keys
        on. Plain `execute` runs as the superuser and stays subject to the guard."""
        return execute('BEGIN; SET LOCAL ROLE service_role;' + sql + 'COMMIT;', check)

    def assert_rejected(self, sql, message='last lead'):
        result = execute(sql, check=False)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn(message, result.stderr)

    def test_unprivileged_writes_cannot_remove_last_lead(self):
        execute(f"UPDATE public.organization_members SET role='organizer' WHERE user_id='{self.b}';")
        for sql in [
            f"UPDATE public.organization_members SET role='organizer' WHERE user_id='{self.a}';",
            f"DELETE FROM public.organization_members WHERE user_id='{self.a}';",
            f"INSERT INTO public.organization_members(user_id,organization_id,role) VALUES ('{self.a}','{self.org}','organizer') ON CONFLICT(user_id,organization_id) DO UPDATE SET role=excluded.role;"
        ]:
            with self.subTest(sql=sql):
                self.assert_rejected(sql)

    def test_lead_organizer_cannot_remove_the_last_lead(self):
        # The invariant that still binds: the team page acts as the signed-in
        # lead, so an organization cannot demote or remove its way into having
        # no lead and losing team and settings management.
        execute(f"UPDATE public.organization_members SET role='organizer' WHERE user_id='{self.b}';")
        for sql in [
            f"SELECT public.remove_organization_member('{self.org}','{self.a}')",
            f"SELECT public.set_organization_member_role('{self.org}','{self.a}','organizer')",
            f"SELECT public.invite_organization_member('{self.org}','{self.phones[0]}','organizer')"
        ]:
            with self.subTest(sql=sql):
                result = self.as_user(self.a, sql, check=False)
                self.assertNotEqual(result.returncode, 0)
                self.assertIn('last lead', result.stderr)

    def test_admin_and_service_role_may_remove_the_last_lead(self):
        # Admins are the ones who have to repair an organization whose only lead
        # is gone, so the guard exempts them: the admin API writes as the service
        # role, and an admin's own session is recognized by has_platform_role.
        execute(f"UPDATE public.organization_members SET role='organizer' WHERE user_id='{self.b}';")
        self.as_service_role(f"UPDATE public.organization_members SET role='organizer' WHERE user_id='{self.a}';")
        self.assertEqual(execute(f"SELECT count(*) FROM public.organization_members WHERE organization_id='{self.org}' AND role='lead_organizer';").stdout.strip(), '0')

        execute(f"UPDATE public.organization_members SET role='lead_organizer' WHERE user_id='{self.a}';")
        self.as_user(self.admin, f"SELECT public.remove_organization_member('{self.org}','{self.a}')")
        self.assertEqual(execute(f"SELECT count(*) FROM public.organization_members WHERE organization_id='{self.org}' AND user_id='{self.a}';").stdout.strip(), '0')

    def test_revocation_removes_login_grant_and_rejoin_is_denied(self):
        execute(f"INSERT INTO public.organizer_affiliations_phone_whitelist(phone_number,affiliate_organization_id,invited_role) VALUES ('{self.phones[1]}','{self.org}','lead_organizer');")
        self.as_user(self.a, f"SELECT public.remove_organization_member('{self.org}','{self.b}')")
        self.assertEqual(execute(f"SELECT count(*) FROM public.organizer_affiliations_phone_whitelist WHERE affiliate_organization_id='{self.org}';").stdout.strip(), '0')
        self.assert_rejected(f"SELECT public.join_organization_from_invite('{self.b}','{self.org}');", 'revoked')

    def test_direct_membership_delete_also_revokes_invite(self):
        execute(f"INSERT INTO public.organizer_affiliations_phone_whitelist(phone_number,affiliate_organization_id) VALUES ('{self.phones[1]}','{self.org}'); DELETE FROM public.organization_members WHERE user_id='{self.b}';")
        self.assertEqual(execute(f"SELECT count(*) FROM public.organizer_affiliations_phone_whitelist WHERE affiliate_organization_id='{self.org}';").stdout.strip(), '0')

    def test_researcher_membership_cannot_authorize_team_rpc(self):
        # A researcher gets no org RLS grant even with a stored lead membership:
        # the researcher role caps org access at the SQL layer (as it does in the
        # app), so researcher dashboard reads go through the service-role client
        # with explicit scoping rather than PostgREST/RLS. has_org_role is false
        # at both levels.
        execute(f"INSERT INTO public.organization_members(user_id,organization_id,role) VALUES ('{self.researcher}','{self.org}','lead_organizer');")
        result = self.as_user(self.researcher, f"SELECT public.has_org_role('{self.org}','organizer'), public.has_org_role('{self.org}','lead_organizer')")
        self.assertIn('f|f', result.stdout)
        execute(f"INSERT INTO public.user_roles(user_id,role) VALUES ('{self.researcher}','researcher') ON CONFLICT(user_id) DO UPDATE SET role=excluded.role;")
        result = self.as_user(self.researcher, f"SELECT public.invite_organization_member('{self.org}','{self.phones[2]}','organizer')", check=False)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('not authorized', result.stderr)
        result = self.as_user(self.researcher, 'SELECT * FROM public.claim_organizer_membership_alerts()', check=False)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('permission denied', result.stderr)

    def test_deleting_sole_lead_auth_user_cascades(self):
        # Make self.a the only lead, then delete their auth account. The delete
        # cascades to organization_members; the last-lead guard must NOT block it
        # (otherwise driver opt-out / admin "delete driver" 500 for a sole lead).
        execute(f"DELETE FROM public.organization_members WHERE user_id='{self.b}';")
        result = execute(f"DELETE FROM auth.users WHERE id='{self.a}';", check=False)
        self.assertEqual(result.returncode, 0, result.stderr)
        remaining = execute(
            f"SELECT count(*) FROM public.organization_members WHERE organization_id='{self.org}';"
        ).stdout.strip()
        self.assertEqual(remaining, '0')

    def test_cannot_make_only_effective_lead_a_researcher(self):
        execute(f"UPDATE public.user_roles SET role='researcher' WHERE user_id='{self.b}';")
        self.assert_rejected(f"UPDATE public.user_roles SET role='researcher' WHERE user_id='{self.a}';")
        self.assert_rejected(f"DELETE FROM public.organization_members WHERE user_id='{self.a}';")
        # The admin API assigns platform roles as the service role, and that path
        # is exempt like every other admin write.
        self.as_service_role(f"UPDATE public.user_roles SET role='researcher' WHERE user_id='{self.a}';")
        self.assertEqual(execute(f"SELECT role FROM public.user_roles WHERE user_id='{self.a}';").stdout.strip(), 'researcher')

    def test_direct_rpc_creates_durable_alert_once(self):
        self.as_user(self.a, f"SELECT public.invite_organization_member('{self.org}','{self.phones[2]}','organizer')")
        self.as_user(self.a, f"SELECT public.invite_organization_member('{self.org}','{self.phones[2]}','organizer')")
        self.assertEqual(execute(f"SELECT count(*) FROM public.organizer_membership_alerts WHERE user_id='{self.member}';").stdout.strip(), '1')
        self.assertEqual(execute(f"SELECT count(*) FROM public.organizer_logging WHERE user_id='{self.member}' AND action='member_joined';").stdout.strip(), '1')

    def test_login_rechecks_invite_and_preserves_existing_role(self):
        execute(f"INSERT INTO public.organizer_affiliations_phone_whitelist(phone_number,affiliate_organization_id,invited_role) VALUES ('{self.phones[2]}','{self.org}','organizer'); SELECT public.join_organization_from_invite('{self.member}','{self.org}'); UPDATE public.organization_members SET role='lead_organizer' WHERE user_id='{self.member}'; SELECT public.join_organization_from_invite('{self.member}','{self.org}');")
        self.assertEqual(execute(f"SELECT role FROM public.organization_members WHERE user_id='{self.member}';").stdout.strip(), 'lead_organizer')
        self.assertEqual(execute(f"SELECT count(*) FROM public.organizer_membership_alerts WHERE user_id='{self.member}';").stdout.strip(), '1')

    def test_alert_claims_are_exclusive_and_expired_leases_retry(self):
        # Roll back claims, including any unrelated queued work on a developer DB.
        # Park events that are not this test's so a busy developer queue (the
        # claim takes ten at a time) cannot push our event out of a batch.
        execute(f"""BEGIN;
          UPDATE public.organizer_membership_alerts SET available_at=now()+interval '1 hour'
          WHERE user_id<>'{self.a}';
          SELECT public.claim_organizer_membership_alerts();
          DO $$ BEGIN
            IF EXISTS (SELECT 1 FROM public.claim_organizer_membership_alerts() WHERE user_id='{self.a}') THEN
              RAISE EXCEPTION 'already leased event was claimed twice';
            END IF;
          END $$;
          UPDATE public.organizer_membership_alerts SET available_at=now()-interval '1 second'
          WHERE user_id='{self.a}';
          DO $$ BEGIN
            IF NOT EXISTS (SELECT 1 FROM public.claim_organizer_membership_alerts() WHERE user_id='{self.a}' AND attempts=2) THEN
              RAISE EXCEPTION 'expired event was not retried';
            END IF;
          END $$;
          UPDATE public.organizer_membership_alerts SET abandoned_at=now(), available_at=now()-interval '1 second'
          WHERE user_id='{self.a}';
          DO $$ BEGIN
            IF EXISTS (SELECT 1 FROM public.claim_organizer_membership_alerts() WHERE user_id='{self.a}') THEN
              RAISE EXCEPTION 'abandoned event was claimed';
            END IF;
          END $$;
          ROLLBACK;""")

    def test_concurrent_demotions_leave_one_lead(self):
        first = subprocess.Popen(['psql', DATABASE_URL, '-XqAt', '-v', 'ON_ERROR_STOP=1'],
                                 stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        second = None
        try:
            first.stdin.write(f"BEGIN; UPDATE public.organization_members SET role='organizer' WHERE user_id='{self.a}'; SELECT 'locked';\n")
            first.stdin.flush()
            self.assertEqual(first.stdout.readline().strip(), 'locked')
            second = subprocess.Popen(['psql', DATABASE_URL, '-XqAt', '-v', 'ON_ERROR_STOP=1'],
                                      stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
            second.stdin.write(f"UPDATE public.organization_members SET role='organizer' WHERE user_id='{self.b}';\n")
            second.stdin.flush()
            time.sleep(0.2)
            self.assertIsNone(second.poll(), 'the competing change should wait for the organization lock')
            first.communicate('COMMIT;\n', timeout=5)
            _, errors = second.communicate('', timeout=5)
            self.assertNotEqual(second.returncode, 0)
            self.assertIn('last lead', errors)
            self.assertEqual(execute(f"SELECT count(*) FROM public.organization_members WHERE organization_id='{self.org}' AND role='lead_organizer';").stdout.strip(), '1')
        finally:
            for process in (first, second):
                if process and process.poll() is None:
                    process.kill()
                    process.communicate()


class PlatformAdminRegressions(unittest.TestCase):
    """`guard_last_admin`: the platform can never be left without an admin.

    These tests own the invariant, which is global rather than per-organization,
    so setUp parks every pre-existing admin and cleanup puts them back. That is
    safe only because this script refuses to run against anything but a local
    disposable database (see the check at import time).
    """

    def setUp(self):
        self.a, self.b = str(uuid.uuid4()), str(uuid.uuid4())
        self.addCleanup(self.cleanup)
        self.parked = [line for line in execute(
            "SELECT user_id FROM public.user_roles WHERE role='admin';").stdout.split() if line]
        sql = ''
        for user in (self.a, self.b):
            sql += f"INSERT INTO auth.users(id,email) VALUES ('{user}','{user}@rbac.example.test');"
            sql += f"INSERT INTO public.user_roles(user_id,role) VALUES ('{user}','admin');"
        # Park the real admins only after the fixtures are admins, so the guard
        # sees a survivor at every row it checks.
        if self.parked:
            parked = ','.join(f"'{user}'" for user in self.parked)
            sql += f"UPDATE public.user_roles SET role='driver' WHERE user_id IN ({parked});"
        execute('BEGIN;' + sql + 'COMMIT;')

    def cleanup(self):
        sql = ''
        if self.parked:
            parked = ','.join(f"'{user}'" for user in self.parked)
            sql += f"UPDATE public.user_roles SET role='admin' WHERE user_id IN ({parked});"
        sql += f"DELETE FROM auth.users WHERE id IN ('{self.a}','{self.b}');"
        execute('BEGIN;' + sql + 'COMMIT;')

    def demote_b(self):
        """Leave `a` as the only admin. This one must succeed."""
        execute(f"UPDATE public.user_roles SET role='driver' WHERE user_id='{self.b}';")

    def assert_rejected(self, sql, role=None):
        prefix = f'BEGIN; SET LOCAL ROLE {role};' if role else ''
        suffix = 'COMMIT;' if role else ''
        result = execute(prefix + sql + suffix, check=False)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('last platform admin', result.stderr)

    def test_last_admin_cannot_be_demoted_or_deleted(self):
        self.demote_b()
        self.assert_rejected(f"UPDATE public.user_roles SET role='researcher' WHERE user_id='{self.a}';")
        self.assert_rejected(f"DELETE FROM public.user_roles WHERE user_id='{self.a}';")
        self.assertEqual(execute(
            f"SELECT role FROM public.user_roles WHERE user_id='{self.a}';").stdout.strip(), 'admin')

    def test_service_role_cannot_bypass_the_guard(self):
        # Every write behind the admin API arrives as service_role. Unlike the
        # last-lead guard, this one has no service_role exemption — an exemption
        # would make it dead code exactly where the mistake happens.
        self.demote_b()
        self.assert_rejected(
            f"UPDATE public.user_roles SET role='researcher' WHERE user_id='{self.a}';",
            role='service_role')

    def test_deleting_the_auth_user_cascades_past_the_guard(self):
        # Blocking the cascade would make the sole admin's account undeletable.
        self.demote_b()
        execute(f"DELETE FROM auth.users WHERE id='{self.a}';")
        self.assertEqual(execute(
            f"SELECT count(*) FROM public.user_roles WHERE user_id='{self.a}';").stdout.strip(), '0')

    def test_concurrent_demotions_leave_one_admin(self):
        first = subprocess.Popen(['psql', DATABASE_URL, '-XqAt', '-v', 'ON_ERROR_STOP=1'],
                                 stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        second = None
        try:
            first.stdin.write(f"BEGIN; UPDATE public.user_roles SET role='researcher' WHERE user_id='{self.a}'; SELECT 'locked';\n")
            first.stdin.flush()
            self.assertEqual(first.stdout.readline().strip(), 'locked')
            second = subprocess.Popen(['psql', DATABASE_URL, '-XqAt', '-v', 'ON_ERROR_STOP=1'],
                                      stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
            second.stdin.write(f"UPDATE public.user_roles SET role='researcher' WHERE user_id='{self.b}';\n")
            second.stdin.flush()
            time.sleep(0.2)
            # The advisory lock in the guard is what makes this wait instead of
            # counting a row the other session is about to demote.
            self.assertIsNone(second.poll(), 'the competing demotion should wait on the other admin row')
            first.communicate('COMMIT;\n', timeout=5)
            _, errors = second.communicate('', timeout=5)
            self.assertNotEqual(second.returncode, 0)
            self.assertIn('last platform admin', errors)
            self.assertEqual(execute(
                "SELECT count(*) FROM public.user_roles WHERE role='admin';").stdout.strip(), '1')
        finally:
            for process in (first, second):
                if process and process.poll() is None:
                    process.kill()
                    process.communicate()


if __name__ == '__main__':
    unittest.main(verbosity=2)
