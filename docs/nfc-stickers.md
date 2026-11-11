# Writing NFC stickers from the app

A place's sticker carries one link, `https://seewhatsinhere.com/l/<code>`. The app writes it in three ways:

| Where | How | Code |
| --- | --- | --- |
| iPhone app | Apple's "Ready to Scan" sheet (Core NFC) | `native/sticker-nfc/ios` |
| Android app | Reader mode, with the app's own "hold a sticker" screen | `native/sticker-nfc/android` |
| Website, Chrome on Android | Web NFC | `lib/stickerWriter.ts` |

Safari and every other iPhone browser can't write NFC, so on the website iPhones get the NFC Tools steps instead. Stickers are never locked, so a place's link can be replaced and the sticker rewritten.

`native/sticker-nfc` is a local Capacitor plugin (`"sticker-nfc": "link:native/sticker-nfc"`). `npx cap sync` wires it into `ios/App/CapApp-SPM/Package.swift` and `android/capacitor.settings.gradle`. The iPhone app also needs `ios/App/App/App.entitlements` (NFC tag reading, `TAG` format) and `NFCReaderUsageDescription` in `Info.plist`, both committed.

## Trying it on an iPhone (needs a Mac)

You need a paid Apple Developer account (£79 / $99 a year). Free Apple IDs can't use NFC.

1. Install **Xcode** from the Mac App Store, then **Node 22** from nodejs.org. In Terminal run `npm install -g pnpm`.
2. Get the code: `git clone https://github.com/ianbatchelor/whats-in-there.git` then `cd whats-in-there` and `pnpm install`.
3. Copy `.env.example` to `.env.local` and fill in the Supabase URL and publishable key (the same values as in Vercel's Environment Variables).
4. Run `pnpm cap:sync`, then `npx cap open ios`. Xcode opens.
5. In Xcode click **App** at the top of the left sidebar, then the **Signing & Capabilities** tab. Choose your team under **Team**. "Near Field Communication Tag Reading" should already be listed.
6. Plug in your iPhone and unlock it. If asked, turn on **Settings > Privacy & Security > Developer Mode** and restart the phone.
7. Pick your iPhone at the top of the Xcode window and press the ▶ Run button.
8. In the app: open a place, tap the round sticker button, tap **Write to a sticker**, and hold the top of the iPhone to a sticker.

## Stickers open the app (iPhone)

Tapping a sticker, scanning a QR label or opening an invitation goes straight into the iPhone app when it's installed, through universal links:

- `public/.well-known/apple-app-site-association` lists `GS73N238CQ.com.seewhatsinhere.app` (Apple Team ID + bundle id) for `/l/*` and `/invite/*`. `vercel.json` serves it as JSON.
- `ios/App/App/App.entitlements` has `applinks:seewhatsinhere.com`. Automatic signing adds the Associated Domains capability to the App ID.
- `components/NativeLinks.tsx` routes the link, whether the app was open (`appUrlOpen`) or started by it (`getLaunchUrl`).

iOS fetches the association file when the app is installed, so reinstall from Xcode after it goes live. Android app links (`assetlinks.json` with the signing key's SHA-256) are not set up yet.
