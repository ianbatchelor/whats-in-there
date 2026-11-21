/**
 * The How it works video (made from marketing/explainer, copied to public/video/) and its chapters,
 * so people can jump straight to the part they want. Starts are seconds into the video.
 */
export const HOW_IT_WORKS = { src: "/video/how-it-works.mp4", poster: "/video/how-it-works.jpg", seconds: 71 };

/** The 30-second portrait Christmas video (marketing/explainer/christmas.html). */
export const CHRISTMAS_SHORT = {
  src: "/video/christmas.mp4",
  poster: "/video/christmas.jpg",
  title: "Christmas in 30 seconds",
  sub: "Wish lists that keep the surprise, and everything for the day in one place",
};

export type Chapter = { id: string; title: string; text: string; start: number };

export const CHAPTERS: Chapter[] = [
  { id: "tap", title: "Tap the sticker", text: "Hold your phone to a place's sticker and that place opens.", start: 11 },
  { id: "snap", title: "Snap the label", text: "A photo of the pack fills in the name, size and dates.", start: 18 },
  { id: "share", title: "Everyone sees it, live", text: "One list for the whole household, on everyone's phone.", start: 26 },
  { id: "use", title: "Use the oldest first", text: "What's close to its date, or frozen longest, comes first.", start: 32 },
  { id: "find", title: "Find anything", text: "The attic, the shed, the wardrobe: search them all at once.", start: 38 },
  { id: "lists", title: "Lists for everything", text: "Keep a list to yourself, or share it at home, with family or friends.", start: 43.6 },
  { id: "presents", title: "Present ideas", text: "Wish lists where you can say you're getting something, and it stays a surprise.", start: 50 },
  { id: "christmas", title: "Christmas", text: "Who's getting what, lists for the day, decorations and room in the freezer.", start: 58.5 },
];

/** The chapter playing at a point in the video, or null during the opening. */
export function chapterAt(seconds: number): Chapter | null {
  let found: Chapter | null = null;
  for (const c of CHAPTERS) if (seconds >= c.start) found = c;
  return found;
}

/** "0:43" */
export function clock(seconds: number): string {
  const s = Math.floor(seconds);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
