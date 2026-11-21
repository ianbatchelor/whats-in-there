/**
 * The words on Home's "back from the shops" card: how much was bought, the button that puts it
 * away, and what to do about anything that has no place yet.
 */
export function basketLine(bought: number, ready: number): { title: string; button: string; choose: string } {
  const things = (n: number) => (n === 1 ? "1 thing" : `${n} things`);
  const unplaced = bought - ready;
  return {
    title: `${things(bought)} bought`,
    button: ready === bought ? (bought === 1 ? "Put it away" : "Put them away") : `Put ${ready} away`,
    choose: unplaced === 1 ? "Choose where 1 thing goes on the shopping list" : `Choose where ${unplaced} things go on the shopping list`,
  };
}
