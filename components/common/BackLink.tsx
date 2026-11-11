"use client";

import { useRouter } from "next/navigation";

/** Back to wherever the person came from (the Household screen in the app), or home. */
export function BackLink() {
  const router = useRouter();
  return (
    <button
      type="button"
      className="rounded-full border border-line bg-card px-3.5 py-1.5 text-sm font-semibold"
      onClick={() => (window.history.length > 1 ? router.back() : router.push("/"))}
    >
      Back
    </button>
  );
}
