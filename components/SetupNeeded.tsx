import { Screen } from "@/components/ui/Screen";
import { BrandMark, Wordmark } from "@/components/brand/BrandMark";

export function SetupNeeded() {
  return (
    <Screen className="justify-center">
      <BrandMark size={56} />
      <h1 className="font-display text-3xl font-extrabold tracking-tight">
        <Wordmark /> needs its database
      </h1>
      <p className="text-mute">
        Copy <code className="font-mono">.env.example</code> to <code className="font-mono">.env.local</code>, add your Supabase URL and
        publishable key, then restart the app. The README has the full steps.
      </p>
    </Screen>
  );
}
