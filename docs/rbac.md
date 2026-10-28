# Role-based access control

System has a flat list of **user types**, each with a label and a set of permissions, in
`src/lib/roles.config.ts`. That file is the single place to change what a type can do. Nothing
in the role model refers to a specific organization or deployment, so another organization can
self-host System with the same roles.

Each user type has a `scope` that says where the assignment is stored:

- `platform` types live on `user_roles.role` (one row per user)
- `organization` types live on `organization_members.role` (one row per membership)

## User types

| Type (id)        | Scope        | Label                   | What it grants                                                                                                                                                         |
| ---------------- | ------------ | ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `driver`         | platform     | Worker                  | Nothing beyond row ownership: their own data, take-rate stats, affiliations, consents                                                                                  |
| `organizer`      | platform     | Organizer (legacy)      | Nothing. Still written at organizer login; guards ignore it                                                                                                            |
| `organizer`      | organization | Organizer               | Dashboard, driver PII, exports for that organization                                                                                                                   |
| `lead_organizer` | organization | Organizer administrator | Organizer plus Argyle settings, signup code, driver removal, team management                                                                                           |
| `researcher`     | platform     | Researcher              | Every organization dashboard (except settings and team) and the admin area (except the audit log), read-only. No exports, no mutations. Signs in with email + password |
| `admin`          | platform     | Developer administrator | Every capability across every organization                                                                                                                             |

## Capability matrix

| Capability                           | organizer | lead_organizer | researcher | admin |
| ------------------------------------ | --------- | -------------- | ---------- | ----- |
| `org:view_dashboard`                 | own org   | own org        | all orgs   | all   |
| `org:view_driver_pii`                | own org   | own org        | all orgs   | all   |
| `org:export_driver_data`             | own org   | own org        |            | all   |
| `org:deaffiliate_driver`             |           | own org        |            | all   |
| `org:manage_argyle_settings`         |           | own org        |            | all   |
| `org:manage_signup_code`             |           | own org        |            | all   |
| `org:manage_members`                 |           | own org        |            | all   |
| `platform:view_cross_org_aggregates` |           |                | X          | X     |
| `platform:export_cross_org_data`     |           |                |            | X     |
| `platform:view_admin_dashboard`      |           |                | X          | X     |
| `platform:view_audit_log`            |           |                |            | X     |
| `platform:manage_orgs`               |           |                |            | X     |
| `platform:manage_users`              |           |                |            | X     |
| `platform:manage_admins`             |           |                |            | X     |
| `platform:manage_drivers`            |           |                |            | X     |

`org:*` capabilities always need an organization key. A platform-scoped grant of an `org:*`
capability applies to every organization; a membership grant only to that organization.
`platform:*` capabilities ignore the key. Researcher restrictions override organization
membership grants: even a stored lead membership cannot enable downloads, settings, or Team
while the platform role is `researcher`.

## Enforcement

- `src/lib/rbac.ts` is the pure engine: `hasCapability`, `postLoginPath`, `permissionsFor`,
  `userTypeLabel`, type guards.
- `src/lib/server/rbac.ts`: `loadAuthContext` (reads `user_roles` and `organization_members`)
  and `requireCapability` (throws 403).
- `safeGetSession` returns `roles` and is memoized per request on the access token, so the role
  queries run once per request no matter how many loads ask for them. Always gate on the
  `roles` it hands back, with `requireCapability(roles, …)`; never reload the context from the
  database inside a load or handler.
- Admin area: `requireAdminPage(locals)` gates every `/admin/*` page on
  `platform:view_admin_dashboard`; `/admin/audit` passes `platform:view_audit_log` instead, so
  researchers get a 403 there and the nav and overview drop the link.
  `requireAdminApi(locals, capability)` gates every `/api/admin/*` write on the
  `platform:manage_*` capability it exercises. `/api/admin/platform-users` checks a second
  capability per request: `capabilityForPlatformRole` maps the `admin` role to
  `platform:manage_admins` and everything else to `platform:manage_users`, and the handlers check
  it for both the role being assigned and the one being replaced, so revoking admin is gated as
  tightly as granting it. Only `admin` holds `platform:manage_admins`; the split exists so a
  future operations role could manage researchers without being able to mint admins.
  Admin pages hide mutation controls with `hasCapability(page.data.roles, …)`.
- Exports: `canAccessAnalysisScope(roles, scope, 'export')` requires `org:export_driver_data`
  (or `platform:export_cross_org_data` for `selectedScope=all`). Everything that returns
  individual workers' rows uses it: the CSV downloads, async export requests, the raw
  `policy_analysis_data` pages, and the deactivation report. Stats endpoints use the default
  `'view'` mode. Download buttons are hidden without the capability; the in-browser report
  preview can only hide its buttons, not enforce.
- RLS uses `has_org_role(org_id, min_role)`, which grants only platform `admin` (everywhere)
  and organization members whose `organization_role_rank` meets the minimum. Researchers get
  **no** row-level grant to driver data: an RLS grant is also a bulk read over PostgREST, which
  is a de-facto export, and the spec forbids researcher downloads. A researcher's "view every
  organization dashboard" access is instead served by the server with the service-role client
  and explicit organization scoping (see the organizer `+page.server.ts` loads and
  `filtered_driver_activities`, which call `getDrivers` / `driverBelongsToOrganization`).
- The Argyle settings tab lists the drivers whose **primary** affiliation is the organization
  (`getPrimaryAffiliatedDrivers`). Affiliations are readable only by the driver under RLS, so
  the load reads with the service-role client behind `org:manage_argyle_settings` and scopes
  rows to the organization itself. "Disable sync" there is the `org:deaffiliate_driver`
  teardown (Argyle accounts deleted, every affiliation and consent removed), logged to
  `organizer_logging` as `removed_driver`.
- The deactivation tool (`computeDeactivationData`) reads the driver profile with the service-role
  client for the same reason, scoped by the inner join on the organization's consent row.
- Admin pages hide Argyle identifiers (key id, flow id, link URL, limit) from researchers at the
  load, not only in the template: Argyle settings are outside the researcher's scope.
- Endpoints and loads that read driver rows with the service-role client (the policy-analysis
  RPCs are revoked from `authenticated`, and researcher-reachable dashboards read this way) get
  no RLS scoping, so they must constrain rows themselves — `getDrivers` / `getDriverIds` for
  org-wide queries, `driverBelongsToOrganization` for a named driver. `selectedScope=all` is
  aggregates only and rejects driver-scoped requests. The `organizer_daily_stats` and
  `daily_driver_stats` materialized views are readable only by `service_role`.

## Onboarding

**Organizer administrator (first lead of an organization).** A platform admin whitelists the
phone on `/admin/organizers` and picks the role "Organizer administrator". The whitelist row
stores `invited_role`. The person logs in at `/organizer/login` with their phone and the
organization's signup code; `verify-otp` creates the membership with that role. If the phone
already belongs to a System user, the membership is created immediately.

**Organizer.** A lead organizer invites by phone on `/organizer/org/[key]/team` (or a platform
admin whitelists them). The `invite_organization_member` RPC writes the whitelist (with the
intended role) and, if a user with that phone exists, a membership row. Phones that have not
joined yet appear under **Pending invites**; revoke removes the whitelist row. Removing the last
lead organizer is refused by a table trigger for Team RPCs and for any other write that is not a
platform admin's. Changes serialize on the organization row. Researcher memberships do not count
as active leads; assigning the researcher role to the last active lead is refused on the same
terms. Platform admins and the service-role writes behind the admin API are exempt
(`membership_guard_bypassed`): an organization whose only lead has left has to be repairable from
`/admin/organizers`, and an organization left without a lead simply loses Team and settings
management until an admin grants one. Removing a member deletes their phone whitelist grants
atomically. First login rechecks the invite under
the same organization lock before inserting membership.

**Researchers and developer administrators** are both managed on `/admin/platform-users`
(`/api/admin/platform-users`), which has three verbs and deliberately not two:

- `POST` provisions credentials. If no account exists for the email, one is created with
  `email_confirm`, so no invitation or confirmation email is sent and the admin passes the
  password on out of band. Re-submitting the email of someone who already holds the requested
  role resets their password instead of failing.
- `PATCH` changes an existing user's role and never touches credentials.
- `DELETE` revokes the staff role, setting it back to `organizer` (if they belong to an
  organization) or `driver`, and leaves the account and its password in place.

Splitting `POST` from `PATCH` is what makes promotion safe. A single "add by email" that promoted
whoever owned the address would, on a typo, both reset a real person's password and hand them the
role — and `admin` is every capability in the product. So `POST` refuses any existing account
whose stored role is not the one being asked for, including an account with **no** `user_roles`
row: workers never get one in app code, so "no role" is indistinguishable from a mistyped
worker's address. Promotion goes through a `userId` the admin picked off the list instead, with
the account's identity in front of them. The consequence is that an existing driver or organizer
cannot be promoted from this page at all; `pnpm seed:admins` is the path for that.

An admin cannot change or remove their own role (a 409 from the handler, which is the only layer
that knows who is acting — under `service_role` there is no `auth.uid()` to compare against).
Losing the last admin is refused by the `guard_last_admin` trigger on `user_roles`. Unlike the
last-lead-organizer guard, that trigger has **no** `service_role` exemption: every write behind
the admin API arrives as `service_role`, so an exemption would make it dead code exactly where
the mistake happens. It serializes every revocation on one `pg_advisory_xact_lock`, so two admins
demoting each other at once cannot both succeed (locking the remaining admin rows with
`FOR UPDATE` instead would deadlock: each statement has already locked the row its own trigger
fires for), and it steps aside when the `auth.users` row is already
gone so deleting the sole admin's account still cascades. Every write logs to
`admin_activity_log` as `platform_user.add` / `platform_user.role_changed` /
`platform_user.remove`; passwords are never logged.

Researchers sign in at `/admin/login` — the same email + password form as admins, gated on
`platform:view_admin_dashboard`, which both roles hold. `/organizer/login` is closed to them: it
is only for joining an organization, and they have none.

**Developer administrator.** Admins sign in at `/admin/login` — the email + password form is
their only door, since `/organizer/login` requires an organization signup code and admins belong
to no organization. Day to day they are granted and revoked from `/admin/platform-users` by
another admin, under `platform:manage_admins`.

`pnpm seed:admins <email> <password>` remains the bootstrap and recovery path: it creates the
login and writes `user_roles.role = 'admin'`, which is how the _first_ admin of a deployment
exists and how a deployment left with no admins is repaired. It only ever adds an admin, so
`guard_last_admin` never blocks it. To backfill existing auth users from a leftover
`ADMIN_EMAILS` env var, run `pnpm seed:admins` with no arguments.

A newly created organizer membership (non-demo) writes an `organizer_membership_alerts` outbox
event and a `organizer_logging.member_joined` audit row in the same database transaction. This
covers first login, Team RPCs called directly, admin creation, and service-client inserts.
Existing memberships, repeated invitations, logins, and role changes do not create another event.
Alerts are opt-in on `ORGANIZER_ALERT_EMAILS`: with no recipient configured the Netlify
`sendOrganizerMembershipAlerts` scheduled function returns without calling anything, so no part of
delivery runs. Events are still recorded, so configuring recipients later delivers the backlog.
Once enabled, the function runs every five minutes and calls the internal-authenticated
`/api/send_organizer_membership_alerts` endpoint. It claims up to ten events with `SKIP LOCKED`,
leases them for ten minutes, and sends to `ORGANIZER_ALERT_EMAILS` from `SMTP_FROM`. An event
counts as delivered when at least one recipient accepted it; a recipient that keeps bouncing is
logged, not retried, so the good inboxes are not re-sent the same alert. Delivery failures retry
after five minutes. An event that still fails on its twelfth attempt
(`MAX_ALERT_DELIVERY_ATTEMPTS`) is marked `abandoned_at` and no longer claimed; `last_error` says
why. Crashed workers' leases expire. The endpoint repeats the recipient check and answers `200`
with `disabled: true` without claiming, so a direct call cannot bypass the switch. Delivery is at
least once: a crash after SMTP accepts an email but before acknowledgement can cause a duplicate.
Self-hosted deployments must schedule the same internal endpoint. Development email delivery is
mocked.

Role changes and removals through Team write `member_role_changed` / `member_removed`.
Admin actions also write `admin_activity_log`.

Apply `20260904120001_add_rbac.sql`, `20260911120000_harden_legacy_grants.sql` and
`20260915120000_guard_last_admin.sql` before deploying the corresponding app. `add_rbac` holds the whole model — membership, the capability
helpers, the RLS policies, the table-level invariants and the Team RPCs — and is where the
researcher RLS grant is closed. `harden_legacy_grants` covers only objects that predate this
work: the two stats materialized views, and the default `anon`/`authenticated` EXECUTE grants
that `REVOKE ... FROM PUBLIC` alone leaves on SECURITY DEFINER functions
(`stop_sharing_primary`, `connect_argyle_account_with_capacity`,
`refresh_policy_analysis_views`). When adding a function that the service-role client calls,
always revoke from `PUBLIC, anon, authenticated`. `guard_last_admin` adds the "never zero
admins" invariant, which only became reachable once admins could be revoked from the UI.
Database-level regressions live in `tests/rbac-database-regression.py` and run in CI as part of
the `vitest` job. Locally: `pnpm run test:db-regressions` (or set `RBAC_TEST_DATABASE_URL` to a
local Supabase and run the script directly). The script uses unique fixtures and removes only
those fixtures. It does not invoke email delivery.

`/organizer/login` requires a signup code and refuses a request without one before it looks
anything up, so an anonymous caller learns nothing about the phone they submitted. Do not
reintroduce a codeless branch that logs someone in on phone alone: it would have to read the
caller's role before authenticating them, which turns this endpoint into an oracle for which
phone numbers belong to staff. A wrong code and a valid code with a phone that is not
whitelisted return the same `403` and message, so the code cannot be confirmed independently of
the phone. The organizer
code has no attempt throttle yet; the driver code in `signupCode.ts` does.

## Compatibility notes

`organizer_affiliate_organization_affiliations` is a **view** over `organization_members`
(`organization_id` exposed as `affiliate_organization_id`). Existing reads keep working. New
writes should target `organization_members`. Drop the view in a follow-up once nothing reads it.

If the membership cutover needs to be reversed: the affiliations view is `SECURITY INVOKER` and
has INSTEAD OF insert/delete triggers. Recreating the old table from `organization_members` is
`INSERT INTO ... SELECT user_id, organization_id, created_at`.

The `organizer_daily_stats` materialized view is rebuilt from membership and is not read by app
code. Role revocation there is stale until the next 6am UTC refresh. App-layer guards are
immediate.
