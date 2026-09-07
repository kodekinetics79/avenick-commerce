"use client";

import * as React from "react";
import type { SearchSuggestion, SuggestResponse } from "./search-suggest";

/**
 * The client side of /api/search/suggest: a fetcher and a small hook.
 *
 * Not wired into the header yet — header.tsx is the registered navigation
 * source and is owned elsewhere. The intended call site is the `searchField`
 * form in components/layout/header.tsx: hold the input's value in state, pass
 * it here, and render `suggestions` in a listbox under the field. The form
 * stays a real GET to /search?q= so search keeps working before hydration and
 * with scripting off; the suggestions are an enhancement over it, never the
 * only way to search.
 */

export const SEARCH_SUGGEST_ENDPOINT = "/api/search/suggest";

export function suggestRequestUrl(query: string, limit?: number): string {
  const params = new URLSearchParams({ q: query });
  if (limit != null) params.set("limit", String(limit));
  return `${SEARCH_SUGGEST_ENDPOINT}?${params.toString()}`;
}

export async function fetchSearchSuggestions(
  query: string,
  options: { signal?: AbortSignal; limit?: number } = {},
): Promise<SuggestResponse> {
  const response = await fetch(suggestRequestUrl(query, options.limit), {
    signal: options.signal,
    headers: { accept: "application/json" },
  });
  if (!response.ok) throw new Error(`Suggest request failed with status ${response.status}`);
  const body = (await response.json()) as { success?: boolean; data?: SuggestResponse; error?: string };
  if (!body || body.success === false || !body.data) throw new Error(body?.error ?? "Suggest request failed");
  return body.data;
}

export interface SearchSuggestState {
  /**
   * "idle" — nothing typed; "too_short" — below the floor, nothing was asked;
   * "loading" — a request is in flight for the current text; "ready" —
   * `suggestions` answers the current text; "error" — the request failed, and
   * the field should behave as if there were no suggestions.
   */
  status: "idle" | "too_short" | "loading" | "ready" | "error";
  suggestions: SearchSuggestion[];
  /** The floor the text fell under, when status is "too_short". */
  minLength: number | null;
}

const IDLE: SearchSuggestState = { status: "idle", suggestions: [], minLength: null };

/**
 * Suggestions for `query`, debounced, with stale responses discarded.
 *
 * Each change aborts the previous request before starting the next, so a
 * response can only ever be applied to the text it was asked for. `minLength`
 * mirrors the endpoint's own floor so a one-character field does not fire a
 * request the server would decline anyway.
 */
export function useSearchSuggest(
  query: string,
  options: { debounceMs?: number; limit?: number; minLength?: number } = {},
): SearchSuggestState {
  const { debounceMs = 200, limit = 8, minLength = 2 } = options;
  const trimmed = query.trim();
  const [state, setState] = React.useState<SearchSuggestState>(IDLE);

  React.useEffect(() => {
    if (!trimmed) {
      setState(IDLE);
      return;
    }
    if (trimmed.length < minLength) {
      setState({ status: "too_short", suggestions: [], minLength });
      return;
    }
    const controller = new AbortController();
    setState((previous) => ({ ...previous, status: "loading" }));
    const timer = setTimeout(() => {
      fetchSearchSuggestions(trimmed, { signal: controller.signal, limit })
        .then((data) => {
          if (controller.signal.aborted) return;
          setState(
            data.status === "ran"
              ? { status: "ready", suggestions: data.suggestions, minLength: null }
              : { status: "too_short", suggestions: [], minLength: data.minLength },
          );
        })
        .catch(() => {
          if (controller.signal.aborted) return;
          setState({ status: "error", suggestions: [], minLength: null });
        });
    }, debounceMs);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [trimmed, debounceMs, limit, minLength]);

  return state;
}
