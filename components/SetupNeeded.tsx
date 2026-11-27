import { AuthFrame } from "@/components/AuthFrame";
import { Wordmark } from "@/components/brand/BrandMark";

export function SetupNeeded() {
  return (
    <AuthFrame>
      <h1 className="font-serif text-[2.1rem] leading-[1.05] font-semibold tracking-[-0.015em] text-forest">
        <Wordmark /> needs its database
      </h1>
      <p className="text-mute">
        Copy <code className="font-mono">.env.example</code> to <code className="font-mono">.env.local</code>, add your Supabase URL and
        publishable key, then restart the app. The README has the full steps.
      </p>
    </AuthFrame>
  );
}
