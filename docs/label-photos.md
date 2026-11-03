# Label photos (Milestone 3)

Photograph a label in the add sheet and the name, amount, pack size, brand and printed dates are filled in for you to check. Nothing is saved until you press Add.

## How it works

1. The app shrinks the photo on the phone (longest side 1600px, WebP or JPEG) and uploads it to the private `item-photos` bucket under `{household_id}/labels/`. Storage RLS only lets members of that household write or read there.
2. It calls the `extract-product` Edge Function with the household id and photo path.
3. The function checks the caller is signed in and a member, applies the limits (50 photos per household per day, 6 per person per minute), reads the photo as the caller, and asks Claude (`claude-opus-5-5`, low effort, strict JSON schema) what the label says. Every attempt is logged in `ai_extraction_attempts` with tokens, latency and any error code.
4. The app checks every value again (`lib/domain/extraction.ts`): text is trimmed and capped, units and amounts range-checked, impossible dates dropped. Fields the model was unsure of, or that failed a check, are highlighted for the person to look at.
5. If the item is saved, the photo path is stored on it (`image_path`, `source = 'photo'`). A photo that isn't used (cancelled, retaken, unreadable) is deleted.

Dates are only ever what's printed on the pack. The app never decides whether food is safe.

No database changes were needed: the bucket, its policies, `ai_extraction_attempts` and the `image_path`/`source` columns were all in the Milestone 1 schema.

## Switching it on

Until these steps are done the add sheet still shows "Snap the label", and a photo gets the message "Reading labels isn't switched on yet. Fill it in below for now." Typing works as before.

1. **Anthropic API key.** At https://console.anthropic.com, open API keys and create a key (the account needs credit). Each photo costs roughly one to two pence.
2. **Store it in Supabase.** In the Supabase dashboard for the project, open Edge Functions, then Secrets, and add `ANTHROPIC_API_KEY` with the key as its value. Never put this key in the app or in Vercel.
3. **Deploy the function.** In Edge Functions choose Deploy a new function, then Via Editor. Name it `extract-product`, replace the sample code with the whole of `supabase/functions/extract-product/index.ts`, and deploy. Leave "Verify JWT" on.
   With the Supabase CLI instead: `supabase functions deploy extract-product`.

To check it, add something in the app with a photo, then look at the newest row in `ai_extraction_attempts`: `error_code` should be empty and `parsed_json` filled in.

## Limits and costs

Change `PER_HOUSEHOLD_PER_DAY`, `PER_USER_PER_MINUTE` or `MODEL` at the top of the function and redeploy. The function turns on Anthropic's server-side refusal fallback (`fallbacks: "default"`), so a rare safety decline is retried on another model instead of failing.
