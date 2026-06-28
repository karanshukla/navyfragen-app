import {
  Alert,
  Avatar,
  Button,
  Group,
  Paper,
  PasswordInput,
  Skeleton,
  Stack,
  TextInput,
  Title,
  Text,
  Box,
  Center,
  UnstyledButton,
  useComputedColorScheme,
} from "@mantine/core";
import { useDebouncedValue } from "@mantine/hooks";
import { useQuery } from "@tanstack/react-query";
import { type RefObject, useCallback, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useHaptic } from "use-haptic";
import { z } from "zod";

import { apiClient } from "../api/apiClient";
import { authKeys, useE2ELogin, useLogin } from "../api/authService";
import { queryClient } from "../api/queryClient";
import { WinkMark } from "../components/WinkMark";
import { surfaceBg } from "../styles/tokens";

const handleSchema = z
  .string()
  .min(1, { error: "Handle is required" })
  .max(64, { error: "Handle too long" });

interface BlueskyActor {
  did: string;
  handle: string;
  displayName?: string;
  avatar?: string;
}

// Rendered only when VITE_E2E_TESTING=true is baked into the build.
// Uses an AT Protocol app password to bypass the OAuth redirect, enabling
// automated Playwright tests against a real account on a private PDS.
function E2ELoginPanel() {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const { mutate: e2eLogin, isPending } = useE2ELogin();

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    e2eLogin(
      { identifier, password },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: authKeys.session });
          navigate("/messages");
        },
        onError: (err: any) => {
          setError(err.error || "E2E login failed");
        },
      }
    );
  };

  return (
    <Box maw={480} mx="auto" mt="xl">
      <Paper
        radius="lg"
        p="xl"
        withBorder
        style={{ borderColor: "var(--mantine-color-orange-5)", borderWidth: 2 }}
      >
        <Stack gap="md">
          <Text fw={700} c="orange" size="sm">
            E2E Test Mode - not for production use
          </Text>
          {error && (
            <Alert color="red" withCloseButton onClose={() => setError(null)}>
              {error}
            </Alert>
          )}
          <form onSubmit={onSubmit}>
            <Stack gap="sm">
              <TextInput
                label="Identifier"
                placeholder="handle.pds.example"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                required
                autoCorrect="off"
                autoCapitalize="none"
                spellCheck={false}
                data-testid="e2e-identifier"
              />
              <PasswordInput
                label="App Password"
                placeholder="xxxx-xxxx-xxxx-xxxx"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                data-testid="e2e-password"
              />
              <Button
                type="submit"
                loading={isPending}
                fullWidth
                color="orange"
                mt="xs"
                data-testid="e2e-submit"
              >
                Sign In (E2E)
              </Button>
            </Stack>
          </form>
        </Stack>
      </Paper>
    </Box>
  );
}

// ─── Suggestion box sub-components ───────────────────────────────────────────

const ROW_H = 64;

// Lower score = higher in the list.
// Exact full-handle match → 0, local-part exact → 1, handle prefix → 2,
// display-name prefix → 3, anything else → 4.
function rankActor(actor: BlueskyActor, localQ: string, fullHandle: string): number {
  const handle = actor.handle.toLowerCase();
  if (handle === fullHandle) return 0;
  if (handle === localQ || handle.startsWith(`${localQ}.`)) return 1;
  if (handle.startsWith(localQ)) return 2;
  if ((actor.displayName ?? "").toLowerCase().startsWith(localQ)) return 3;
  return 4;
}

function SuggestionRow({
  actor,
  onClick,
  buttonRef,
  onEscape,
}: {
  actor: BlueskyActor;
  onClick: () => void;
  buttonRef?: RefObject<HTMLButtonElement | null>;
  onEscape?: () => void;
}) {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <UnstyledButton
      ref={buttonRef}
      onClick={onClick}
      onFocus={(e) => setIsFocused(e.currentTarget.matches(":focus-visible"))}
      onBlur={() => setIsFocused(false)}
      onKeyDown={(e: React.KeyboardEvent) => {
        if (e.key === "Escape" || e.key === "ArrowUp") {
          e.preventDefault();
          onEscape?.();
        }
      }}
      w="100%"
      role="option"
      aria-selected={false}
      style={{
        display: "flex",
        alignItems: "center",
        height: ROW_H,
        outline: isFocused ? "2px solid var(--mantine-color-violet-5)" : "none",
        outlineOffset: "-2px",
        background: isFocused
          ? "light-dark(rgba(51,73,224,0.08), rgba(107,63,212,0.20))"
          : undefined,
      }}
    >
      <Group gap="sm" wrap="nowrap" px="sm" w="100%">
        <Avatar src={actor.avatar ?? null} size={40} radius="xl" />
        <Box style={{ minWidth: 0 }}>
          <Text size="sm" fw={500} truncate>
            {actor.displayName || actor.handle}
          </Text>
          <Text size="xs" c="dimmed" truncate>
            @{actor.handle}
          </Text>
        </Box>
      </Group>
    </UnstyledButton>
  );
}

function SkeletonRow() {
  return (
    <Box style={{ display: "flex", alignItems: "center", height: ROW_H }} px="sm">
      <Group gap="sm" wrap="nowrap" w="100%">
        <Skeleton circle height={40} width={40} />
        <Box style={{ flex: 1 }}>
          <Skeleton height={12} width="55%" mb={6} />
          <Skeleton height={10} width="38%" />
        </Box>
      </Group>
    </Box>
  );
}

function HandleSuggestionBox({
  selectedActor,
  isSearchPending,
  suggestions,
  noResults,
  isHandleReady,
  cleanHandle,
  onSelect,
  suggestionRef,
  onEscape,
}: {
  selectedActor: BlueskyActor | null;
  isSearchPending: boolean;
  suggestions: BlueskyActor[];
  noResults: boolean;
  isHandleReady: boolean;
  cleanHandle: string;
  onSelect: (actor: BlueskyActor) => void;
  suggestionRef: RefObject<HTMLButtonElement | null>;
  onEscape: () => void;
}) {
  const skeletonRow = useMemo(() => <SkeletonRow />, []);
  const hasSuggestion = !selectedActor && (suggestions.length > 0 || (noResults && isHandleReady));

  return (
    <Paper
      radius="md"
      withBorder
      mt="xs"
      role={hasSuggestion ? "listbox" : undefined}
      aria-label={hasSuggestion ? "Handle suggestions" : undefined}
      style={{
        background: "light-dark(rgba(0,0,0,0.04), rgba(255,255,255,0.09))",
        overflow: "hidden",
      }}
    >
      {selectedActor ? (
        <Box style={{ display: "flex", alignItems: "center", height: ROW_H }} px="sm">
          <Group gap="sm" wrap="nowrap" w="100%">
            <Avatar src={selectedActor.avatar ?? null} size={40} radius="xl" />
            <Box style={{ minWidth: 0 }}>
              <Text size="sm" fw={600} truncate>
                {selectedActor.displayName || selectedActor.handle}
              </Text>
              <Text size="xs" c="dimmed" truncate>
                @{selectedActor.handle}
              </Text>
            </Box>
          </Group>
        </Box>
      ) : isSearchPending ? (
        skeletonRow
      ) : suggestions.length > 0 ? (
        <SuggestionRow
          actor={suggestions[0]}
          onClick={() => onSelect(suggestions[0])}
          buttonRef={suggestionRef}
          onEscape={onEscape}
        />
      ) : noResults && isHandleReady ? (
        // No Bluesky index results but handle looks complete — offer typed handle directly
        // so users on unindexed third-party PDS instances can still proceed
        <SuggestionRow
          actor={{ did: "", handle: cleanHandle }}
          onClick={() => onSelect({ did: "", handle: cleanHandle })}
          buttonRef={suggestionRef}
          onEscape={onEscape}
        />
      ) : noResults ? (
        <Center style={{ height: ROW_H }} aria-live="polite">
          <Text size="xs" c="dimmed">
            No handles found
          </Text>
        </Center>
      ) : (
        <Center style={{ height: ROW_H }}>
          <Text size="xs" c="dimmed">
            Start typing to get handle suggestions
          </Text>
        </Center>
      )}
    </Paper>
  );
}

// ─── Main login form ──────────────────────────────────────────────────────────

function LoginForm() {
  const location = useLocation();
  const [handle, setHandle] = useState("");
  const [debouncedHandle] = useDebouncedValue(handle, 300);
  // Tracks an actor the user explicitly picked (click or keyboard).
  // Auto-selection is derived separately so no setState-in-effect is needed.
  const [manualSelectedActor, setManualSelectedActor] = useState<BlueskyActor | null>(null);
  const [error, setError] = useState<string | null>(() =>
    new URLSearchParams(location.search).get("error") === "oauth_failed"
      ? "Login failed. Please try again."
      : null
  );
  const [isRedirecting, setIsRedirecting] = useState(false);
  const { mutate: login, isPending } = useLogin();
  const { triggerHaptic } = useHaptic(1);
  const isDark = useComputedColorScheme("light", { getInitialValueInEffect: true }) === "dark";

  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionRef = useRef<HTMLButtonElement>(null);

  const debouncedQuery = debouncedHandle.replace(/^@/, "").trim();
  const cleanHandle = handle.replace(/^@/, "").trim();
  const isHandleReady = cleanHandle.length >= 3 && cleanHandle.includes(".");

  // Strip domain suffix before searching: "karan.bsky.social" → "karan"
  // so typeahead prefix-matching works for both full handles and partial names.
  const dotIdx = debouncedQuery.indexOf(".");
  const searchQ = dotIdx > 1 ? debouncedQuery.slice(0, dotIdx) : debouncedQuery;

  const { data: actorSuggestions = [], isFetching: isSuggestionsLoading } = useQuery({
    queryKey: ["bsky-handle-search", searchQ],
    queryFn: async (): Promise<BlueskyActor[]> => {
      const data = await apiClient.get<{ actors: BlueskyActor[] }>(
        `/handle-search?q=${encodeURIComponent(searchQ)}`
      );
      return data.actors ?? [];
    },
    enabled: searchQ.length >= 2 && !manualSelectedActor,
    staleTime: 30_000,
    throwOnError: false,
  });

  // True from the moment the user starts typing until debounce+fetch settle.
  // Uses manualSelectedActor (not derived selectedActor) to avoid circular deps.
  const isSearchPending =
    !manualSelectedActor &&
    cleanHandle.length >= 2 &&
    (cleanHandle !== debouncedQuery || isSuggestionsLoading);

  const sortedSuggestions = useMemo(() => {
    if (actorSuggestions.length <= 1) return actorSuggestions;
    const full = cleanHandle.toLowerCase();
    const q = searchQ.toLowerCase();
    return [...actorSuggestions].sort((a, b) => rankActor(a, q, full) - rankActor(b, q, full));
  }, [actorSuggestions, cleanHandle, searchQ]);

  // Derive selected actor: manual pick takes priority; if exactly one result is
  // an exact handle match, auto-select it so Enter goes straight to Continue.
  const selectedActor = useMemo(() => {
    if (manualSelectedActor) return manualSelectedActor;
    if (
      !isSearchPending &&
      actorSuggestions.length === 1 &&
      actorSuggestions[0].handle.toLowerCase() === cleanHandle.toLowerCase()
    ) {
      return actorSuggestions[0];
    }
    return null;
  }, [manualSelectedActor, isSearchPending, actorSuggestions, cleanHandle]);

  const noResults =
    !selectedActor && !isSearchPending && cleanHandle.length >= 2 && actorSuggestions.length === 0;

  const selectActor = useCallback((actor: BlueskyActor) => {
    setManualSelectedActor(actor);
    setHandle(actor.handle);
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setHandle(e.target.value);
    if (manualSelectedActor) setManualSelectedActor(null);
  };

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!isHandleReady) return;
    triggerHaptic();
    setError(null);
    const result = handleSchema.safeParse(cleanHandle);
    if (!result.success) {
      setError(result.error.issues[0].message);
      return;
    }
    login(
      { handle: cleanHandle },
      {
        onSuccess: (data) => {
          if (data.redirectUrl) {
            setIsRedirecting(true);
            sessionStorage.setItem("newLogin", "true");
            window.location.href = data.redirectUrl;
          }
        },
        onError: (err: any) => {
          setError(err.error || "Login failed. Please try again.");
        },
      }
    );
  };

  return (
    <Box maw={480} mx="auto">
      <Paper
        radius="lg"
        p="xl"
        withBorder
        style={{
          background: surfaceBg(isDark),
          position: "relative",
          overflow: "hidden",
        }}
      >
        <Box
          style={{
            position: "absolute",
            inset: 0,
            background: isDark
              ? "radial-gradient(ellipse 60% 100% at 50% 0%, rgba(139,92,246,0.15), transparent 70%)"
              : "radial-gradient(ellipse 60% 100% at 50% 0%, rgba(196,181,253,0.4), transparent 70%)",
            pointerEvents: "none",
          }}
        />

        <Stack gap="md" style={{ position: "relative" }}>
          <Center>
            <WinkMark
              size={60}
              sparkle
              style={{
                borderRadius: 16,
                boxShadow: "0 12px 30px -10px rgba(20,18,58,0.4)",
              }}
            />
          </Center>
          <Box ta="center">
            <Title order={1} fw={800} fz={24}>
              Log in to Navyfragen
            </Title>
            <Text size="sm" c="dimmed" mt={4}>
              Enter your AT Protocol handle to continue
            </Text>
          </Box>

          {error && (
            <Alert color="red" withCloseButton onClose={() => setError(null)} role="alert">
              {error}
            </Alert>
          )}

          <form onSubmit={onSubmit}>
            <TextInput
              ref={inputRef}
              label="Atmosphere Handle"
              placeholder="e.g. yourname.bsky.social"
              value={handle}
              onChange={handleChange}
              autoCorrect="off"
              autoCapitalize="none"
              spellCheck={false}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown" && suggestionRef.current) {
                  e.preventDefault();
                  suggestionRef.current.focus();
                } else if (e.key === "Escape" && manualSelectedActor) {
                  setManualSelectedActor(null);
                }
              }}
              aria-haspopup="listbox"
              aria-autocomplete="list"
            />

            <HandleSuggestionBox
              selectedActor={selectedActor}
              isSearchPending={isSearchPending}
              suggestions={sortedSuggestions}
              noResults={noResults}
              isHandleReady={isHandleReady}
              cleanHandle={cleanHandle}
              onSelect={selectActor}
              suggestionRef={suggestionRef}
              onEscape={() => inputRef.current?.focus()}
            />

            <Button
              type="submit"
              mt="xs"
              fullWidth
              loading={isPending || isRedirecting}
              variant="gradient"
              gradient={{ from: "royal", to: "purple", deg: 135 }}
              size="md"
              radius="md"
              style={{
                opacity: isHandleReady ? 1 : 0.45,
                cursor: isHandleReady ? undefined : "not-allowed",
              }}
            >
              Continue
            </Button>
          </form>
        </Stack>
      </Paper>

      <Text size="xs" c="dimmed" ta="center" mt="md" style={{ lineHeight: 1.6 }}>
        You will be directed to Bluesky to authenticate. Navyfragen does not have access to your
        password. Verify you see <strong>navyfragen.app</strong> on the login page.
      </Text>
    </Box>
  );
}

// Dispatches to E2ELoginPanel (VITE_E2E_TESTING=true builds) or the normal
// OAuth form. The build-time constant means exactly one branch is ever reachable
// at runtime, so there is no conditional-hook issue.
export default function Login() {
  if (import.meta.env.VITE_E2E_TESTING === "true") {
    return <E2ELoginPanel />;
  }
  return <LoginForm />;
}
