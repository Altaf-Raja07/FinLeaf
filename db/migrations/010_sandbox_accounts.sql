-- Rename is_demo -> is_sandbox.
--
-- The column marks an account created in a sandbox environment rather than
-- through a verified onboarding flow. "demo" described the project's own purpose;
-- "sandbox" describes the account's status, which is what other systems querying
-- this column actually need to know.
--
-- The default moves to TRUE: any account created by the self-service form in an
-- environment without a verified identity provider is a sandbox account, and
-- making that the default means a future code path cannot forget to set it.
ALTER TABLE users RENAME COLUMN is_demo TO is_sandbox;
ALTER TABLE users ALTER COLUMN is_sandbox SET DEFAULT TRUE;

COMMENT ON COLUMN users.is_sandbox IS
  'TRUE when the account was self-registered in a sandbox environment with no verified identity check.';

-- kyc_reference is described as a synthetic token. Make that explicit in the
-- schema so a future reader cannot mistake it for a real government identifier.
COMMENT ON COLUMN users.kyc_reference IS
  'Opaque internal reference for the account. Never a government identifier; no identity document is collected.';