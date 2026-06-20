import {
  Alert,
  Button,
  TextInput,
  Title,
  Text,
  Paper,
  Box,
  Center,
  Stack,
  useComputedColorScheme,
} from "@mantine/core";
import { useState } from "react";
import { useLocation } from "react-router-dom";
import { useHaptic } from "use-haptic";
import { z } from "zod";

import { useLogin } from "../api/authService";
import { WinkMark } from "../components/WinkMark";
import { surfaceBg } from "../styles/tokens";

const handleSchema = z
  .string()
  .min(1, { error: "Handle is required" })
  .max(64, { error: "Handle too long" });

export default function Login() {
  const location = useLocation();
  const [handle, setHandle] = useState("");
  const [error, setError] = useState<string | null>(() =>
    new URLSearchParams(location.search).get("error") === "oauth_failed"
      ? "Login failed. Please try again."
      : null
  );
  const { mutate: login, isPending } = useLogin();
  const { triggerHaptic } = useHaptic(1);
  const isDark = useComputedColorScheme("light", { getInitialValueInEffect: true }) === "dark";

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    triggerHaptic();
    setError(null);
    const result = handleSchema.safeParse(handle);
    if (!result.success) {
      setError(result.error.issues[0].message);
      return;
    }
    login(
      { handle },
      {
        onSuccess: (data) => {
          if (data.redirectUrl) {
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
            <Title order={2} fw={800} fz={24}>
              Log in to Navyfragen
            </Title>
            <Text size="sm" c="dimmed" mt={4}>
              Enter your Bluesky handle to continue
            </Text>
          </Box>

          {error && (
            <Alert color="red" withCloseButton onClose={() => setError(null)} role="alert">
              {error}
            </Alert>
          )}

          <form onSubmit={onSubmit}>
            <TextInput
              label="Bluesky Handle"
              placeholder="e.g. yourname.bsky.social"
              value={handle}
              onChange={(e) => setHandle(e.target.value)}
              required
              autoCorrect="off"
              autoCapitalize="none"
              spellCheck={false}
            />
            <Button
              type="submit"
              mt="md"
              fullWidth
              loading={isPending}
              variant="gradient"
              gradient={{ from: "royal", to: "purple", deg: 135 }}
              size="md"
              radius="md"
            >
              Continue with Bluesky
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
