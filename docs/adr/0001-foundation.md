# 0001 Foundation decisions

Date: 3 November 2026. Status: accepted.

## One static web build for web, iOS and Android
Next.js with `output: "export"`; every screen is a client component. Vercel serves it and Capacitor bundles the same files. Dynamic data comes from Supabase in the browser, so there is no server rendering to reproduce inside the native apps. Routes use query strings (`/invite/?token=`) rather than dynamic segments so they export statically.

## Supabase, data access from the client, protected by RLS
Every household-scoped table has `household_id`, and every policy is a membership check through `is_member()` / `is_owner()` (security definer, fixed `search_path`). The API roles start with no table privileges; each table is granted only what it needs, column by column where it matters (for example `link_code` is never writable from the app).

## Inventory changes only through SQL functions
`add_stock`, `remove_stock` and `undo_movement` lock the row, check membership and `version`, update the quantity and append to `stock_movements` in one transaction. The app has no insert, update or delete rights on stock or history, so history can't be skipped and two people can't silently overwrite each other (`version_conflict`).

## Invitations in SQL instead of an Edge Function
`create_invitation` returns a random 32-byte token once and stores only its SHA-256. `accept_invitation` checks revoked, used and expired in one transaction. Doing this in Postgres removed a moving part from Milestone 1. The plan's Edge Functions remain for AI extraction (Milestone 3).

## Sticker codes are separate from location ids
Locations keep a permanent UUID. Stickers carry a 10-character base62 `link_code`, so renaming never touches a sticker and an owner can rotate a leaked code. `resolve_location_code` answers the same for an unknown code and someone else's location.

## Errors as short codes
SQL functions raise codes such as `insufficient_quantity`; `lib/supabase/errors.ts` turns them into plain English and never shows raw database messages.

## Testing the database without Docker
Supabase's local stack needs Docker, which isn't always available (including in CI sandboxes). `scripts/db-test.sh` runs the real migrations on PostgreSQL 16 with a minimal shim for `auth.users`, `auth.uid()`, the API roles and `storage.objects`. The shim reproduces Supabase's default grants so the "revoke everything first" step is genuinely exercised.

## Placeholders to settle before Milestone 4
- Domain: `seewhatsinhere.com` (bought 2026-11-03). It is written onto every sticker as `https://seewhatsinhere.com/l/<code>`, so it must never lapse.
- Bundle id `com.whatsinthere.app`: changing it after store submission means new listings.
