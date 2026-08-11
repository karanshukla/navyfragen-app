import { useDebouncedValue } from "@mantine/hooks";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useMemo, useState } from "react";

import { apiClient } from "../api/apiClient";

export interface BlueskyActor {
  did: string;
  handle: string;
  displayName?: string;
  avatar?: string;
}

const DEBOUNCE_MS = 300;
const MIN_QUERY_LENGTH = 2;
/** Shortest thing that could plausibly be a full handle: "a.bc". */
const MIN_HANDLE_LENGTH = 3;

/**
 * Lower score = higher in the list. Exact full-handle match → 0, local-part
 * exact → 1, handle prefix → 2, display-name prefix → 3, anything else → 4.
 */
export function rankActor(actor: BlueskyActor, localQ: string, fullHandle: string): number {
  const handle = actor.handle.toLowerCase();
  if (handle === fullHandle) return 0;
  if (handle === localQ || handle.startsWith(`${localQ}.`)) return 1;
  if (handle.startsWith(localQ)) return 2;
  if ((actor.displayName ?? "").toLowerCase().startsWith(localQ)) return 3;
  return 4;
}

export interface HandleSearch {
  /** Raw input, including any leading "@" the user typed. */
  input: string;
  setInput: (value: string) => void;
  /** Input with "@" and surrounding whitespace removed. */
  cleanHandle: string;
  /** Long enough and dotted enough to be worth submitting. */
  isHandleReady: boolean;
  suggestions: BlueskyActor[];
  /** Set once the user (or an exact match) has settled on one actor. */
  selectedActor: BlueskyActor | null;
  select: (actor: BlueskyActor) => void;
  clearSelection: () => void;
  /** A newer query is in flight or still debouncing. */
  isSearching: boolean;
  /** Search settled with nothing to offer. */
  noResults: boolean;
}

/**
 * Typeahead over Bluesky's actor search, ranked so the handle the user is
 * actually typing surfaces first.
 *
 * @see [Login.test.tsx](../tests/pages/Login.test.tsx): pins the ranking, the
 * auto-selection of a lone exact match, and the unindexed-PDS fallback.
 */
export function useHandleSearch(): HandleSearch {
  const [input, setInput] = useState("");
  const [debouncedInput] = useDebouncedValue(input, DEBOUNCE_MS);
  // Explicit picks only; auto-selection is derived, so no setState-in-effect.
  const [manualSelectedActor, setManualSelectedActor] = useState<BlueskyActor | null>(null);

  const debouncedQuery = debouncedInput.replace(/^@/, "").trim();
  const cleanHandle = input.replace(/^@/, "").trim();
  const isHandleReady = cleanHandle.length >= MIN_HANDLE_LENGTH && cleanHandle.includes(".");

  // "karan.bsky.social" → "karan", so prefix matching works for full handles too.
  const dotIdx = debouncedQuery.indexOf(".");
  const searchQ = dotIdx > 1 ? debouncedQuery.slice(0, dotIdx) : debouncedQuery;

  const { data: actors = [], isFetching } = useQuery({
    queryKey: ["bsky-handle-search", searchQ],
    queryFn: async (): Promise<BlueskyActor[]> => {
      const data = await apiClient.get<{ actors: BlueskyActor[] }>(
        `/handle-search?q=${encodeURIComponent(searchQ)}`
      );
      return data.actors ?? [];
    },
    enabled: searchQ.length >= MIN_QUERY_LENGTH && !manualSelectedActor,
    staleTime: 30_000,
    throwOnError: false,
  });

  // Reads manualSelectedActor rather than the derived selectedActor: the latter
  // depends on this value.
  const isSearching =
    !manualSelectedActor &&
    cleanHandle.length >= MIN_QUERY_LENGTH &&
    (cleanHandle !== debouncedQuery || isFetching);

  const suggestions = useMemo(() => {
    if (actors.length <= 1) return actors;
    const full = cleanHandle.toLowerCase();
    const q = searchQ.toLowerCase();
    return [...actors].sort((a, b) => rankActor(a, q, full) - rankActor(b, q, full));
  }, [actors, cleanHandle, searchQ]);

  // A lone exact handle match auto-selects so Enter goes straight to Continue.
  const selectedActor = useMemo(() => {
    if (manualSelectedActor) return manualSelectedActor;
    if (
      !isSearching &&
      actors.length === 1 &&
      actors[0].handle.toLowerCase() === cleanHandle.toLowerCase()
    ) {
      return actors[0];
    }
    return null;
  }, [manualSelectedActor, isSearching, actors, cleanHandle]);

  const select = useCallback((actor: BlueskyActor) => {
    setManualSelectedActor(actor);
    setInput(actor.handle);
  }, []);

  return {
    input,
    setInput: (value) => {
      setInput(value);
      setManualSelectedActor(null);
    },
    cleanHandle,
    isHandleReady,
    suggestions,
    selectedActor,
    select,
    clearSelection: () => setManualSelectedActor(null),
    isSearching,
    noResults:
      !selectedActor &&
      !isSearching &&
      cleanHandle.length >= MIN_QUERY_LENGTH &&
      actors.length === 0,
  };
}
