import type { CapacitorConfig } from "@capacitor/cli";

// The native apps bundle the static web build from out/. Bundle id is a placeholder until the
// domain and store listings are decided; changing it later means new store listings.
const config: CapacitorConfig = {
  appId: "com.seewhatsinhere.app",
  appName: "See What's in Here",
  webDir: "out",
  ios: { contentInset: "never" },
  android: { allowMixedContent: false },
};

export default config;
