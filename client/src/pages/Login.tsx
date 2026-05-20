import {
  Button,
  TextInput,
  Title,
  Text,
  Paper,
  Box,
  Center,
  Stack,
  Notification,
} from "@mantine/core";
import { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { z } from "zod";

import { useLogin } from "../api/authService";
import { WinkMark } from "../components/WinkMark";

export default function Login() {
  const [handle, setHandle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const location = useLocation();

  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    if (searchParams.get("error") === "oauth_failed") {
      setError("Login failed. Please try again.");
    }
  }, [location]);

  const handleSchema = z.string().min(1, "Handle is required").max(64, "Handle too long");
  const { mutate: login, isPending } = useLogin();

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const result = handleSchema.safeParse(handle);
    if (!result.success) {
      setError(result.error.errors[0].message);
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
        style={{
          background: "linear-gradient(135deg, #1E1B4B 0%, #3B2E78 50%, #6B3FD4 100%)",
          border: "1px solid rgba(255,255,255,0.08)",
          color: "#FDF8FF",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* WinkMark watermark */}
        <Box style={{ position: "absolute", right: -28, top: -28, opacity: 0.08, pointerEvents: "none" }}>
          <WinkMark size={160} sparkle={false} aria-hidden />
        </Box>

        <Stack gap="md" style={{ position: "relative" }}>
          <Center>
            <WinkMark size={60} sparkle style={{ borderRadius: 16 }} />
          </Center>
          <Box ta="center">
            <Title order={2} style={{ color: "#FDF8FF", fontWeight: 800, fontSize: 24 }}>
              Log in to Navyfragen
            </Title>
            <Text size="sm" style={{ color: "rgba(253,248,255,0.65)" }} mt={4}>
              Enter your Bluesky handle to continue
            </Text>
          </Box>

          {error && (
            <Notification color="red" withCloseButton onClose={() => setError(null)} styles={{ root: { background: "rgba(220,38,38,0.15)", border: "1px solid rgba(220,38,38,0.3)" }, title: { color: "#FCA5A5" }, description: { color: "#FCA5A5" } }}>
              {error}
            </Notification>
          )}

          <form onSubmit={onSubmit}>
            <TextInput
              label="Bluesky Handle"
              placeholder="e.g. yourname.bsky.social"
              value={handle}
              onChange={(e) => setHandle(e.target.value)}
              required
              styles={{
                label: { color: "rgba(253,248,255,0.8)", fontWeight: 600 },
                input: {
                  background: "rgba(255,255,255,0.08)",
                  border: "1px solid rgba(255,255,255,0.15)",
                  color: "#FDF8FF",
                },
              }}
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
        You will be directed to Bluesky to authenticate. Navyfragen does not have access to your password.
        Verify you see <strong>navyfragen.app</strong> on the login page.
      </Text>
    </Box>
  );
}
