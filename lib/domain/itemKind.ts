/**
 * A rough guess at what kind of thing something is, from its name, so lists can show a small
 * picture instead of initials. Only ever used for the icon; a wrong guess costs nothing.
 */
export type ItemKind =
  | "meat" | "fish" | "dairy" | "veg" | "bakery" | "tin" | "frozen" | "drink" | "wine"
  | "clothes" | "tool" | "garden" | "light" | "paper" | "thing";

const WORDS: [ItemKind, RegExp][] = [
  ["wine", /\b(wine|rioja|merlot|malbec|shiraz|chardonnay|sauvignon|pinot|prosecco|champagne|cava|port|whisky|whiskey|gin|vodka|rum|beer|lager|ale|cider)\b/],
  ["frozen", /\b(ice cream|ice lolly|lollies|sorbet|ice cubes?|frozen)\b/],
  ["fish", /\b(fish|salmon|cod|haddock|tuna|prawns?|mackerel|trout|sea bass|scampi|fish fingers?)\b/],
  ["meat", /\b(beef|mince|steak|chicken|pork|lamb|bacon|sausages?|ham|turkey|duck|burgers?|meatballs?|gammon|chorizo|ribs)\b/],
  ["dairy", /\b(milk|cheese|cheddar|brie|feta|mozzarella|parmesan|halloumi|yoghurt|yogurt|butter|cream|eggs?|custard)\b/],
  ["bakery", /\b(bread|loaf|rolls?|baguette|bagels?|croissants?|pastry|pizza|pie|cake|muffins?|crumpets?|wraps?|naan|pitta)\b/],
  ["veg", /\b(peas|beans|carrots?|broccoli|spinach|sweetcorn|corn|potato(es)?|chips|onions?|peppers?|tomato(es)?|berries|strawberr(y|ies)|raspberr(y|ies)|blueberr(y|ies)|apples?|bananas?|fruit|veg|vegetables?|salad|lettuce|herbs?|mushrooms?|garlic|lemons?)\b/],
  ["drink", /\b(juice|squash|water|cola|lemonade|tea|coffee|smoothie)\b/],
  ["tin", /\b(tin|tins|tinned|can|cans|jar|jars|sauce|soup|rice|pasta|flour|sugar|oil|vinegar|honey|jam|cereal|oats|lentils|chickpeas|stock|spice|spices|noodles|curry|lasagne|stew|chilli|casserole|bolognese|leftovers?)\b/],
  ["clothes", /\b(tops|t-shirts?|knitwear|cardigans?|hoodies?|sweatshirts?|blouses?|skirts?|shorts|nightwear|pyjamas|sportswear|underwear|blazers?|sandals|heels|belts?|ties|bags?|coats?|jackets?|jumpers?|shirts?|trousers|jeans|dress(es)?|shoes|boots|trainers|scarf|scarves|hats?|gloves|socks|suits?|wellies|bedding|duvet|blankets?|towels?|pillows?|curtains?)\b/],
  ["garden", /\b(compost|seeds?|bulbs?|plants?|pots?|feed|fertiliser|fertilizer|soil|mulch|hose|watering can|trowel|secateurs|spade|rake|mower|strimmer|shears)\b/],
  ["light", /\b(lights?|bulbs?|lamps?|lanterns?|torch(es)?|candles?|batter(y|ies)|chargers?|cables?|extension lead)\b/],
  ["tool", /\b(drill|hammer|saw|screwdrivers?|spanners?|wrench|pliers|screws|nails|paint|brush(es)?|ladder|tape|glue|sandpaper|toolbox|tools?|stove)\b/],
  ["paper", /\b(fiction|non-fiction|novels?|crime|thrillers?|sci-fi|fantasy|children's|biography|memoir|poetry|cookery|cookbooks?|reference|philosophy|albums?|photos?|books?|documents?|passports?|papers?|files?|letters?|cards?|certificates?|manuals?|magazines?|records?)\b/],
];

/** Bookshop sections that only mean "books" when they are the section, not words in a name. */
const BOOK_SECTIONS = /\b(history|travel|nature|art & design|health & wellbeing|business|religion|science|politics|humour|graphic novels?|young adult|classics)\b/;

export function itemKind(name: string, category?: string | null): ItemKind {
  // A section someone chose ("Fiction", "Coats & jackets") says more than words in a title
  // ("The Garden Party" is a book, not a garden thing), so it is checked on its own first.
  const section = (category ?? "").toLowerCase();
  if (section) {
    if (BOOK_SECTIONS.test(section)) return "paper";
    for (const [kind, re] of WORDS) if (re.test(section)) return kind;
  }
  const text = `${name} ${category ?? ""}`.toLowerCase();
  // "light bulbs" are lights and "tulip bulbs" are garden: let the more specific neighbour decide.
  if (/\b(light|led|spare)\s+bulbs?\b/.test(text)) return "light";
  for (const [kind, re] of WORDS) if (re.test(text)) return kind;
  return "thing";
}
