import * as React from "react";
import Link from "next/link";
import { Eyebrow, PageHeader, Surface } from "@avenick/ui";

/**
 * The shared shell for every policy and information page.
 *
 * /terms, /privacy and /cookies each grew their own copy of this layout, and
 * two of the three shipped with the bug the third had already fixed: a table of
 * contents written `hidden lg:sticky` with no `lg:block`, so it was hidden at
 * every breakpoint and never appeared on any screen at all. Five more pages
 * cloning a 230-line file is five more places for that to happen, so the shape
 * lives here once and the pages supply only their content.
 *
 * It is a Server Component and stays one: nothing here has state, and a policy
 * page is the last surface that should ship a client bundle.
 *
 * BILINGUAL BY CONSTRUCTION. Every section carries both scripts and the caller
 * cannot supply one without the other — the type requires all four fields. A
 * legal page that renders half-translated is worse than one that is honestly
 * English-only, and making the Arabic optional is how it drifts.
 *
 * The table of contents is a <details> on small screens and a sticky aside on
 * large ones. The disclosure needs no client component, works before hydration
 * and with scripting off, and its chevron is drawn from rotated borders, so
 * there is nothing to mirror in Arabic. Markers use `border-s`, not `border-l`,
 * so they sit at the reading start in both directions.
 */

export interface PolicySection {
  /** Anchor id. Stable — it is linked to from elsewhere and from search results. */
  id: string;
  titleEn: string;
  titleAr: string;
  contentEn: React.ReactNode;
  contentAr: React.ReactNode;
}

export interface PolicyShellProps {
  isAr: boolean;
  titleEn: string;
  titleAr: string;
  descriptionEn: string;
  descriptionAr: string;
  eyebrowEn: string;
  eyebrowAr: string;
  sections: PolicySection[];
  /**
   * Provenance. `<Dateline>`'s rule (LAW E) applies: state what is and is not
   * recorded rather than typing a date nothing tracks. /terms already says
   * "No revision date is shown because none is recorded" for exactly this
   * reason, and these pages say the same until something records it.
   */
  datelineEn?: string;
  datelineAr?: string;
}

const NO_REVISION_EN = "No revision date is shown because none is recorded";
const NO_REVISION_AR = "لا يسجل النظام تاريخ آخر تعديل لهذا النص، فلا يُعرض تاريخ";

export function PolicyShell({
  isAr,
  titleEn,
  titleAr,
  descriptionEn,
  descriptionAr,
  eyebrowEn,
  eyebrowAr,
  sections,
  datelineEn = NO_REVISION_EN,
  datelineAr = NO_REVISION_AR,
}: PolicyShellProps) {
  const tocLabel = isAr ? "جدول المحتويات" : "Table of contents";

  return (
    <div className="mx-auto max-w-shell px-gutter py-block">
      <PageHeader
        eyebrow={isAr ? eyebrowAr : eyebrowEn}
        title={isAr ? titleAr : titleEn}
        description={isAr ? descriptionAr : descriptionEn}
        dateline={isAr ? datelineAr : datelineEn}
        linkComponent={Link}
      />

      <details className="u-facet mb-stack border-y border-hairline lg:hidden">
        <summary className="u-focus">
          <span className="u-micro text-ink-3">{tocLabel}</span>
          <span className="u-facet__chev" aria-hidden="true" />
        </summary>
        <nav aria-label={tocLabel} className="flex flex-col pb-3">
          {sections.map((sec) => (
            <a
              key={sec.id}
              href={`#${sec.id}`}
              className="u-focus u-ui rounded-e-nested border-s-2 border-hairline py-1.5 ps-3 text-ink-2"
            >
              {isAr ? sec.titleAr : sec.titleEn}
            </a>
          ))}
        </nav>
      </details>

      <div className="grid grid-cols-1 items-start gap-block lg:grid-cols-[240px_minmax(0,1fr)]">
        {/* `lg:block` is present. Its absence is what hid this aside at every
            breakpoint on the pages this shell replaces. */}
        <aside className="hidden lg:block">
          <div className="lg:sticky lg:top-24">
            <Eyebrow as="h2">{tocLabel}</Eyebrow>
            <nav aria-label={tocLabel} className="mt-3 flex flex-col">
              {sections.map((sec) => (
                <a
                  key={sec.id}
                  href={`#${sec.id}`}
                  className="u-focus u-ui rounded-e-nested border-s-2 border-hairline py-1.5 ps-3 text-ink-3 transition-colors duration-press ease-standard hover:border-border-strong hover:text-ink-1"
                >
                  {isAr ? sec.titleAr : sec.titleEn}
                </a>
              ))}
            </nav>
          </div>
        </aside>

        <div className="flex flex-col gap-stack">
          {sections.map((sec) => (
            <Surface key={sec.id} rung={2} id={sec.id} as="section" className="scroll-mt-24 p-6">
              <h2 className="u-h3 text-ink-1">{isAr ? sec.titleAr : sec.titleEn}</h2>
              <div className="u-body mt-3 flex flex-col gap-3 text-ink-2">
                {isAr ? sec.contentAr : sec.contentEn}
              </div>
            </Surface>
          ))}
        </div>
      </div>
    </div>
  );
}
