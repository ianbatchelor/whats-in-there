/** Turns the short codes raised by our SQL functions (and common auth errors) into plain English. */
const messages: Record<string, string> = {
  not_signed_in: "You've been signed out. Sign in again to carry on.",
  not_found: "That couldn't be found. It may have been removed by someone else in your household.",
  not_owner: "Only the household owner can do that.",
  invalid_amount: "Enter an amount greater than zero.",
  insufficient_quantity: "There isn't that much left.",
  version_conflict: "Someone else just changed this. We've refreshed it, so check and try again.",
  already_undone: "That's already been undone.",
  cannot_undo: "That change can't be undone any more.",
  invitation_invalid: "This invitation link isn't valid. Ask for a new one.",
  invitation_expired: "This invitation has expired. Ask for a new one.",
  invitation_used: "This invitation has already been used. Ask for a new one.",
  last_owner: "You're the only owner. Make someone else an owner before you leave.",
};

export function friendlyError(error: unknown): string {
  const raw =
    typeof error === "string"
      ? error
      : error && typeof error === "object" && "message" in error
        ? String((error as { message: unknown }).message)
        : "";
  const code = Object.keys(messages).find((k) => raw === k || raw.startsWith(`${k}`));
  if (code) return messages[code]!;
  if (/token has expired|invalid.*otp|otp.*invalid/i.test(raw)) return "That code didn't work. Check it, or send a new one.";
  if (/rate limit|too many/i.test(raw)) return "Too many attempts. Wait a minute and try again.";
  if (/failed to fetch|network/i.test(raw)) return "Can't reach the server. Check your connection and try again.";
  return "Something went wrong. Please try again.";
}
