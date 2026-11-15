# Phone notifications

People choose per list whether to hear about it (the **Notify me** bell). Wish lists and lists shared with
family or a group start on; household lists start off; private lists have no bell. Claims ("I'm getting
this") never send anything, and the person a wish list is for isn't told about ideas added for them.

## How it works

1. Adding a wish idea or a list entry runs a trigger (`notify_new_idea`, `notify_new_entry`) that writes one
   row per person to tell into `notify_events`, for people whose bell is on, who haven't paused, and who have
   a phone registered.
2. pg_cron runs every minute and, only when something is waiting, calls the `send-notifications` Edge
   Function (`supabase/scripts/notifications-cron.sql`), with a secret kept in Vault.
3. The function asks `notifications_due()` for lists that have been quiet for 5 minutes (or busy for 30),
   outside each person's quiet hours, sends one message per person and list through Apple (APNs), and marks
   them sent. A token is tried on production first and then the sandbox (Xcode builds), and the answer is
   remembered.

## One-time setup

| Step | Who |
|---|---|
| Apple Developer > Certificates, IDs & Profiles > Keys > **+**, tick Apple Push Notifications service, Sandbox & Production, download the .p8 (offered once). Done 2026-11-15: Key ID 5F74X37223. | ian |
| Push Notifications on the App ID: Xcode adds this when it signs a build with the new entitlement. | automatic |
| Run the migrations `20261115000001_notifications.sql` and `20261115000002_notify_cron_secret.sql`. | Claude (Supabase connector) |
| Deploy `send-notifications` with Verify JWT **off**. | Claude |
| Secret `APNS_KEY`: the .p8 file's whole text. Key ID 5F74X37223 and team GS73N238CQ are built in. | ian pastes into the Supabase prompt |
| Run `supabase/scripts/notifications-cron.sql` with the project URL (it makes the cron secret in Vault). | Claude |
| Build to a phone, tap **Notify me**, then People > Notifications > **Send me a test notification**. | Claude builds, ian checks |

## Cost

Nothing extra: Apple doesn't charge for notifications, and the function only runs when something is
waiting, well inside the Supabase Pro allowance.
