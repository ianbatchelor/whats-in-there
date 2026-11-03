import type { CapacitorConfig } from "@capacitor/cli";

// The native apps bundle the static web build from out/. Bundle id is a placeholder until the
// domain and store listings are decided; changing it later means new store listings.
const config: CapacitorConfig = {
  appId: "com.whatsinthere.app",
  appName: "What's in There?",
  webDir: "out",
  ios: { contentInset: "never" },
  android: { allowMixedContent: false },
};

export default config;
