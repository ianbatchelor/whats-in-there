import { describe, expect, it } from "vitest";
import { money, nameFromLink, readPage, safeUrl, tidyTitle } from "../../supabase/functions/read-link/parse";

const page = (head: string, body = "") => `<!doctype html><html><head>${head}</head><body>${body}</body></html>`;

describe("which links the server will open", () => {
  it("allows ordinary shop links", () => {
    expect(safeUrl("https://www.johnlewis.com/item/p123")?.hostname).toBe("www.johnlewis.com");
  });
  it("refuses anything that could reach inside a network", () => {
    for (const bad of ["http://localhost/", "http://127.0.0.1/", "http://[::1]/", "http://10.0.0.5/x", "https://shop.internal/", "ftp://x.com/", "https://a:b@x.com/", "https://x.com:8080/"])
      expect(safeUrl(bad), bad).toBeNull();
  });
});

describe("reading a shop page", () => {
  const url = new URL("https://www.example-shop.co.uk/p/1");
  it("uses schema.org Product data first", () => {
    const html = page(
      `<title>Nice Mug | Example Shop</title><script type="application/ld+json">${JSON.stringify({
        "@context": "https://schema.org",
        "@graph": [{ "@type": "Product", name: "Le Creuset Stoneware Mug, 350ml", image: ["https://img.example.com/mug.jpg"], brand: { name: "Le Creuset" }, offers: { price: "18.00", priceCurrency: "GBP" } }],
      })}</script>`,
    );
    expect(readPage(html, url)).toMatchObject({ title: "Le Creuset Stoneware Mug, 350ml", image: "https://img.example.com/mug.jpg", price: "£18", brand: "Le Creuset", robotWall: false });
  });
  it("falls back to the link-preview tags", () => {
    const html = page(
      `<meta property="og:title" content="Cashmere Jumper &amp; Scarf"><meta property="og:image" content="https://img.example.com/j.jpg"><meta property="product:price:amount" content="89.5"><meta property="product:price:currency" content="GBP">`,
    );
    expect(readPage(html, url)).toMatchObject({ title: "Cashmere Jumper & Scarf", image: "https://img.example.com/j.jpg", price: "£89.50" });
  });
  it("reads Amazon's own page parts when Amazon shows the real page", () => {
    const html = page(
      `<title>Amazon.co.uk: Sony WH-1000XM6 : Electronics</title>`,
      `<span id="productTitle" class="a-size-large">  Sony WH-1000XM6 Noise Cancelling Headphones  </span><img id="landingImage" data-old-hires="https://m.media-amazon.com/images/I/abc.jpg"><span class="a-price"><span class="a-offscreen">£349.00</span></span>`,
    );
    expect(readPage(html, new URL("https://www.amazon.co.uk/dp/B0TEST"))).toMatchObject({
      title: "Sony WH-1000XM6 Noise Cancelling Headphones",
      image: "https://m.media-amazon.com/images/I/abc.jpg",
      price: "£349.00",
    });
  });
  it("spots a 'prove you're human' page and uses nothing from it", () => {
    const html = page("<title>Amazon.co.uk</title>", "<p>Enter the characters you see below. Sorry, we just need to make sure you're not a robot.</p><form action='/errors/validateCaptcha'>");
    expect(readPage(html, new URL("https://www.amazon.co.uk/dp/B0TEST"))).toMatchObject({ title: null, robotWall: true });
  });
});

describe("tidying up", () => {
  it("takes Amazon's shop words off a title", () => {
    expect(tidyTitle("Amazon.co.uk: LEGO Botanicals Orchid : Toys & Games", "amazon.co.uk")).toBe("LEGO Botanicals Orchid");
    expect(tidyTitle("Wool Throw | John Lewis & Partners", "johnlewis.com")).toBe("Wool Throw");
  });
  it("gets a name from the words in an Amazon link", () => {
    expect(nameFromLink(new URL("https://www.amazon.co.uk/Sony-WH-1000XM5-Cancelling-Headphones-Black/dp/B09XS7JWHH/ref=sr_1_1"))).toBe("Sony WH 1000XM5 Cancelling Headphones Black");
    expect(nameFromLink(new URL("https://www.amazon.co.uk/dp/B09XS7JWHH"))).toBeNull();
  });
  it("writes prices the British way, keeping other currencies", () => {
    expect(money("24.99", "GBP")).toBe("£24.99");
    expect(money("30", "")).toBe("£30");
    expect(money("40", "EUR")).toBe("€40");
    expect(money("0", "GBP")).toBeNull();
  });
});
