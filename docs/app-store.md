# Getting ready for the App Store

What the "store-ready" update added, and the few steps that need someone with access to Supabase.

## What's in the app now

- **Camera and photo permission text** in `ios/App/App/Info.plist`. Without it iOS closes the app the moment a scan opens the camera.
- **Delete my account** (Household screen). The person confirms with a fresh email code, or their password if they signed in with one, then the `delete-account` Edge Function runs `delete_account_data` and deletes their sign-in. Households where they were alone are deleted with their photos; shared households carry on and, if needed, the longest-standing member becomes owner.
- **Sign in with a password**, a small link on the sign-in screen, for the App Store demo account. Everyone else still uses email codes.
- **Ask before AI reads a photo**: the first scan on a device explains that photos go to Claude (Anthropic) and asks for OK.
- **Privacy, Terms and Help pages** at `/privacy/`, `/terms/` and `/help/`, linked from the Household screen and the website footer.
- **App icon and launch screen** from the brand mark (`scripts/brand/render-icons.mjs` redraws them).
- **Apple's privacy manifest** (`ios/App/App/PrivacyInfo.xcprivacy`), "no special encryption" so uploads don't ask about export compliance, iPhone only and portrait only for the first release.

## Steps in Supabase (once)

1. **SQL Editor**: run `supabase/migrations/20261111000003_delete_account.sql`.
2. **Edge Functions → Deploy a new function → Via editor**: name it `delete-account`, paste `supabase/functions/delete-account/index.ts`, deploy. It needs no secrets. Then, as with extract-product, open the function's **Settings** tab and turn **Verify JWT** off: the function checks the caller's sign-in itself and only ever acts for that person.
3. **The demo account for Apple's reviewers**: Authentication → Users → Add user → Create new user. Email `appreview@seewhatsinhere.com`, a strong password, tick **Auto Confirm User**. Then in the SQL Editor run `supabase/scripts/demo-account.sql`, which fills it with a sample household (six places, nineteen things). The email address doesn't need a real mailbox.

The demo email and password go in App Store Connect → the app → App Review Information → Sign-in required.

## Checking it

- Sign in with the demo account (Sign in with a password) and see "The Riverside House".
- Scan a label on the iPhone: the AI question appears once, then the camera opens.
- With a throwaway account: Household → Delete my account → code → you land on the sign-in screen saying the account was deleted.
