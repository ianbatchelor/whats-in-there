/** Turns the short codes raised by our SQL functions (and common auth errors) into plain English. */
const messages: Record<string, string> = {
  not_signed_in: "You've been signed out. Sign in again to carry on.",
  not_found: "That couldn't be found. It may have been removed by someone else in your household.",
  not_owner: "Only the household owner can do that.",
  invalid_amount: "Enter an amount greater than zero.",
  invalid_name: "Say what it is, for example Chicken curry.",
  insufficient_quantity: "There isn't that much left.",
  version_conflict: "Someone else just changed this. We've refreshed it, so check and try again.",
  already_undone: "That's already been undone.",
  cannot_undo: "That change can't be undone any more.",
  invitation_invalid: "This invitation link isn't valid. Ask for a new one.",
  invitation_expired: "This invitation has expired. Ask for a new one.",
  invitation_used: "This invitation has already been used. Ask for a new one.",
  reauth_needed: "For your safety, confirm it's you again, then try once more.",
  delete_failed: "We couldn't finish deleting your account. Please try again.",
  no_place: "Choose a place for it to go first.",
  already_on_list: "That's already on the shopping list.",
  already_taken: "Someone else has just said they're getting that one.",
  name_needed: "Add your first name, so others know who's getting it.",
  too_many_books: "That list is full for now. Take a few books off, or try again later.",
  too_many_lists: "This household already has lots of friends' lists. Ask them to make room first.",
  list_not_empty: "You already have ideas on a list of your own here. Move them across or take them off first.",
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
  if (/token has expired|invalid.*otp|otp.*invalid/i.test(raw)) return "That code didn't work. Only the code in the newest email works, and only for a short while. Check the latest email, or send a new code and wait for it to arrive.";
  if (/could not find the function|function .* does not exist/i.test(raw)) return "This needs a quick database update first. It'll work once that's done.";
  if (/invalid input value for enum/i.test(raw)) return "This kind of place needs a quick database update first. Pick another kind for now.";
  if (/captcha/i.test(raw)) return "We couldn't check you're not a robot. Reload the page and try again.";
  if (/rate limit|too many/i.test(raw)) return "Too many attempts. Wait a minute and try again.";
  if (/failed to fetch|network/i.test(raw)) return "Can't reach the server. Check your connection and try again.";
  return "Something went wrong. Please try again.";
}
