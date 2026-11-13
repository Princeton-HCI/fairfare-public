-- ============================================================================
-- One-off export of every account in System's Argyle account
-- ============================================================================
--
-- Filled by data-scripts/exportArgyleAccounts.ts, which lists every account
-- from Argyle's GET /v2/accounts (System's global keys) and saves one row per
-- account. Used to find accounts Argyle bills for whose connection status is
-- not "connected".
--
-- Each run of the script replaces the whole table, so it always holds the
-- latest download (exported_at says when that was).
-- ============================================================================

CREATE TABLE public.argyle_accounts_export (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  argyle_account uuid NOT NULL,
  argyle_user uuid,
  employers text[],
  connection_status text,
  connection_error_code text,
  connection_error_message text,
  connection_updated_at timestamptz,
  argyle_created_at timestamptz,
  argyle_updated_at timestamptz,
  -- The full account object as Argyle returned it.
  account jsonb NOT NULL,
  exported_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT argyle_accounts_export_argyle_account_key UNIQUE (argyle_account)
);

ALTER TABLE public.argyle_accounts_export ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.argyle_accounts_export FROM PUBLIC;
REVOKE ALL ON public.argyle_accounts_export FROM anon;
REVOKE ALL ON public.argyle_accounts_export FROM authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.argyle_accounts_export TO service_role;

CREATE POLICY "Service role manages argyle accounts export"
ON public.argyle_accounts_export
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);
