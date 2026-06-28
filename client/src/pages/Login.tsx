import {
  Alert,
  Autocomplete,
  Avatar,
  Button,
  Group,
  Loader,
  PasswordInput,
  TextInput,
  Title,
  Text,
  Paper,
  Box,
  Center,
  Stack,
  useComputedColorScheme,
} from "@mantine/core";
import { useDebouncedValue } from "@mantine/hooks";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
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

// Keyed on PDS hostnames returned by /handle-pds. Entries that share a hostname
// prefix (bsky.network covers all per-user shard hosts) are matched with endsWith.
const KNOWN_PDS_HOSTS: Array<[string, string]> = [
  ["bsky.social", "Bluesky"],
  ["bsky.network", "Bluesky"],
  ["bsky.team", "Bluesky"],
];

function pdsHostToLabel(host: string): string {
  const match = KNOWN_PDS_HOSTS.find(([suffix]) => host === suffix || host.endsWith(`.${suffix}`));
  return match ? match[1] : host;
}

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

  const onSubmit = (e: React.FormEvent) => {
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

function LoginForm() {
  const location = useLocation();
  const [handle, setHandle] = useState("");
  const [debouncedHandle] = useDebouncedValue(handle, 300);
  const [error, setError] = useState<string | null>(() =>
    new URLSearchParams(location.search).get("error") === "oauth_failed"
      ? "Login failed. Please try again."
      : null
  );
  const [isRedirecting, setIsRedirecting] = useState(false);
  const { mutate: login, isPending } = useLogin();
  const { triggerHaptic } = useHaptic(1);
  const isDark = useComputedColorScheme("light", { getInitialValueInEffect: true }) === "dark";

  const debouncedQuery = debouncedHandle.replace(/^@/, "").trim();
  const cleanHandle = handle.replace(/^@/, "").trim();
  const isHandleReady = cleanHandle.length >= 3 && cleanHandle.includes(".");

  const { data: pdsHost, isFetching: isPdsResolving } = useQuery({
    queryKey: ["handle-pds", debouncedQuery],
    queryFn: async () => {
      const data = await apiClient.get<{ pds: string }>(
        `/handle-pds/${encodeURIComponent(debouncedQuery)}`
      );
      return data.pds;
    },
    enabled: isHandleReady && debouncedQuery === cleanHandle,
    staleTime: 5 * 60_000,
    throwOnError: false,
  });

  const pdsLabel = pdsHost ? pdsHostToLabel(pdsHost) : "Bluesky";
  const { data: suggestions = [] } = useQuery({
    queryKey: ["bsky-handle-search", debouncedQuery],
    queryFn: async (): Promise<BlueskyActor[]> => {
      const data = await apiClient.get<{ actors: BlueskyActor[] }>(
        `/handle-search?q=${encodeURIComponent(debouncedQuery)}`
      );
      return data.actors;
    },
    enabled: debouncedQuery.length >= 2,
    staleTime: 30_000,
    throwOnError: false,
  });

  const onSubmit = async (e: React.FormEvent) => {
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
    <Box maw={480} mx="auto" mt="xl">
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
            <Autocomplete
              label="Bluesky Handle"
              placeholder="e.g. yourname.bsky.social"
              value={handle}
              onChange={setHandle}
              data={suggestions.map((a) => ({ value: a.handle, label: a.handle }))}
              renderOption={({ option }) => {
                const actor = suggestions.find((a) => a.handle === option.value);
                return (
                  <Group gap="sm" wrap="nowrap">
                    <Avatar src={actor?.avatar ?? null} size="sm" radius="xl" />
                    <Box style={{ minWidth: 0 }}>
                      <Text size="sm" fw={500} truncate>
                        {actor?.displayName || option.value}
                      </Text>
                      <Text size="xs" c="dimmed" truncate>
                        @{option.value}
                      </Text>
                    </Box>
                  </Group>
                );
              }}
              filter={({ options }) => options}
              autoCorrect="off"
              autoCapitalize="none"
              spellCheck={false}
            />
            <Button
              type="submit"
              mt="md"
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
              <Group gap="xs" wrap="nowrap" align="center">
                Continue with
                {isPdsResolving ? <Loader size={14} color="white" /> : " " + pdsLabel}
              </Group>
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
