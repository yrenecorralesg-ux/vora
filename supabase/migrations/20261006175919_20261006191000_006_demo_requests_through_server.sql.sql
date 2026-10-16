/*
# Require demo requests to use the validated server endpoint

1. Purpose
- Prevent direct anonymous writes to demo_requests through the Supabase Data API.
- Make the Next.js endpoint the single public write boundary so validation and abuse controls are applied consistently.

2. Security changes
- Revoke INSERT on demo_requests from anon.
- The server service client continues to persist validated requests after Zod validation and honeypot checks.

3. Data safety
- No rows are deleted or modified.
*/

REVOKE INSERT ON TABLE demo_requests FROM anon;
