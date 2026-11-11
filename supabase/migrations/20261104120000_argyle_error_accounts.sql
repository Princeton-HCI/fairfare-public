-- ============================================================================
-- Argyle accounts whose connection is in an error state
-- ============================================================================
--
-- Argyle accounts that are not connected, with the error Argyle
-- reports and the System driver it belongs to, so organizers can follow up.
--
-- Holds driver contact details (email, name, address, phone), so only the
-- service role can read or write it.
-- ============================================================================

CREATE TABLE public.argyle_error_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  argyle_user uuid NOT NULL,
  argyle_account uuid NOT NULL,
  status text,
  error_code text,
  user_id uuid,
  employer text,
  argyle_created_at timestamptz,
  argyle_updated_at timestamptz,
  email text,
  last_initial text,
  first_name text,
  address text,
  phone text,
  affiliate_organization text,
  CONSTRAINT argyle_error_accounts_account_user_key
    UNIQUE (argyle_account, argyle_user, user_id)
);

ALTER TABLE public.argyle_error_accounts ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.argyle_error_accounts FROM PUBLIC;
REVOKE ALL ON public.argyle_error_accounts FROM anon;
REVOKE ALL ON public.argyle_error_accounts FROM authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.argyle_error_accounts TO service_role;

CREATE POLICY "Service role manages argyle error accounts"
ON public.argyle_error_accounts
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);
