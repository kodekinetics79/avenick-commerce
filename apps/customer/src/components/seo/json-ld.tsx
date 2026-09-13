/**
 * One schema.org JSON-LD block.
 *
 * WHY THERE WAS NONE. Not one page on the storefront carried structured data, so
 * a search engine had to guess the site's name, its logo and where a category
 * sits in the catalogue from the visible markup alone.
 *
 * WHAT MAY GO IN ONE, AND WHAT MUST NOT. Only facts this deployment already
 * holds: the configured name, its own address, its generated icon, and the
 * category tree the breadcrumb on the page is drawn from. No Product, Offer,
 * AggregateRating or Review markup. The catalogue is quote-only, so an Offer
 * price is a number no anonymous buyer can pay, and a rating in a rich result is
 * the "4.8 average" LAW F forbids, only rendered by somebody else. Markup that
 * a page's visible content does not back is also against every search engine's
 * structured-data policy.
 *
 * WHY THE ESCAPE. The payload is inlined into a <script> element, and some of its
 * strings come from the catalogue — a category name a seller's import wrote. A
 * `</script>` inside one would close the element early and turn the rest of the
 * string into markup. `<` is escaped as its JSON unicode form, which a JSON
 * parser reads back as the same character and an HTML parser cannot act on.
 *
 * A server component with no state; it renders nothing a visitor sees.
 */
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }}
    />
  );
}

/** JSON for a <script> body: `<` cannot start a tag, so the element cannot be closed from inside. */
export function serializeJsonLd(data: Record<string, unknown>): string {
  return JSON.stringify({ "@context": "https://schema.org", ...data }).replace(/</g, "\\u003c");
}
