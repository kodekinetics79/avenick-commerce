/**
 * Dates and durations for the buyer suite, in the reader's language.
 *
 * The buyer suite formatted every date with `date-fns`' `format(d, "MMM d,
 * yyyy")`, which has no locale argument here and therefore printed "Feb 14,
 * 2026" on the Arabic page. An Arabic column of English month abbreviations is
 * the same defect as an English label in an Arabic sentence: it says the Arabic
 * build is a setting rather than a design.
 *
 * `Intl` is used rather than a date-fns locale bundle because it is already in
 * every runtime, it costs nothing, and — the part that matters — it lets the
 * numbering system be PINNED.
 *
 * `-u-nu-latn` IS THE WHOLE POINT OF THIS FILE. A bare `ar` locale returns
 * Arabic-Indic digits (١٤ فبراير ٢٠٢٦). DESIGN_SYSTEM.md §2.3 sets one numeral
 * system, Western, everywhere: it is the GCC commerce convention, it is what
 * `tabular-nums` can actually align, and IBM Plex Mono has no Arabic-Indic
 * coverage at all, so an invoice number beside an Arabic-Indic date would fall
 * back to a system face mid-row. Every formatter below pins it.
 */

function tag(locale: string | undefined): string {
  return locale === "ar" ? "ar-u-nu-latn" : "en-US";
}

export interface B2BFormats {
  /** 14 Feb 2026 — the default for a recorded date. */
  date: (value: Date | string) => string;
  /** 14 Feb — for a due date inside a dense row, where the year is implied. */
  dateShort: (value: Date | string) => string;
  /** 14 Feb, 09:20 — for a message on a thread. */
  dateTime: (value: Date | string) => string;
  /** February 2026 — for "account opened". */
  month: (value: Date | string) => string;
  /** "3 days ago" / "قبل 3 أيام" — how long a queue row has been waiting. */
  relative: (value: Date | string) => string;
}

const toDate = (value: Date | string) => (value instanceof Date ? value : new Date(value));

export function b2bFormats(locale: string | undefined): B2BFormats {
  const l = tag(locale);
  const date = new Intl.DateTimeFormat(l, { day: "numeric", month: "short", year: "numeric" });
  const dateShort = new Intl.DateTimeFormat(l, { day: "numeric", month: "short" });
  const dateTime = new Intl.DateTimeFormat(l, {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const month = new Intl.DateTimeFormat(l, { month: "long", year: "numeric" });
  // numeric:"auto" is what turns -1 into "yesterday" rather than "1 day ago" in
  // both languages. The unit is chosen rather than always days, because "45 days
  // ago" is a number a reader has to convert and "last month" is not.
  const rtf = new Intl.RelativeTimeFormat(l, { numeric: "auto" });

  return {
    date: (v) => date.format(toDate(v)),
    dateShort: (v) => dateShort.format(toDate(v)),
    dateTime: (v) => dateTime.format(toDate(v)),
    month: (v) => month.format(toDate(v)),
    relative: (v) => {
      const ms = toDate(v).getTime() - Date.now();
      const days = Math.round(ms / 86_400_000);
      if (Math.abs(days) < 1) {
        const hours = Math.round(ms / 3_600_000);
        if (Math.abs(hours) < 1) return rtf.format(Math.round(ms / 60_000), "minute");
        return rtf.format(hours, "hour");
      }
      if (Math.abs(days) < 31) return rtf.format(days, "day");
      if (Math.abs(days) < 365) return rtf.format(Math.round(days / 30), "month");
      return rtf.format(Math.round(days / 365), "year");
    },
  };
}
