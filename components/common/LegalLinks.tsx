import Link from "next/link";

/** Privacy, Terms and Help, for the Household screen and the website footer. */
export function LegalLinks({ className = "" }: { className?: string }) {
  return (
    <nav aria-label="About this app" className={`flex flex-wrap gap-x-5 gap-y-1 text-sm text-mute ${className}`}>
      <Link href="/help/" className="underline-offset-4 hover:underline">Help</Link>
      <Link href="/privacy/" className="underline-offset-4 hover:underline">Privacy</Link>
      <Link href="/terms/" className="underline-offset-4 hover:underline">Terms</Link>
    </nav>
  );
}
