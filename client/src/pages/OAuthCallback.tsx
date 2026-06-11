import {
  Box,
  Center,
  Loader,
  Stack,
  Text,
  Title,
  Paper,
  Button,
  useComputedColorScheme,
} from "@mantine/core";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Link } from "react-router-dom";

import { apiClient } from "../api/apiClient";
import { authKeys } from "../api/authService";
import { WinkMark } from "../components/WinkMark";
import { surfaceBg } from "../styles/tokens";

export default function OAuthCallback() {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const isDark = useComputedColorScheme("light", { getInitialValueInEffect: true }) === "dark";

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const token = params.get("oauth_token");
    if (!token) {
      setError("Missing OAuth token in callback URL.");
      setLoading(false);
      return;
    }
    apiClient
      .post<{ success: boolean }, { oauth_token: string }>("/oauth/consume", {
        oauth_token: token,
      })
      .then(async () => {
        await queryClient.refetchQueries({ queryKey: authKeys.session });
        navigate("/messages");
      })
      .catch((err) => {
        setError(err.error || err.message || "Failed to complete OAuth login.");
        setLoading(false);
      });
  }, [location, navigate, queryClient]);

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

        <Stack gap="md" align="center" style={{ position: "relative" }}>
          <WinkMark size={60} sparkle={loading} style={{ borderRadius: 16, boxShadow: "0 12px 30px -10px rgba(20,18,58,0.4)" }} />

          {loading ? (
            <>
              <Title order={2} fw={800} fz={24} ta="center">
                Logging you in…
              </Title>
              <Text size="sm" c="dimmed" ta="center">
                Completing your Bluesky authentication
              </Text>
              <Loader size="sm" />
            </>
          ) : (
            <>
              <Title order={2} fw={800} fz={24} ta="center" c="red">
                Login failed
              </Title>
              <Text size="sm" c="dimmed" ta="center">
                {error}
              </Text>
              <Button
                component={Link}
                to="/login"
                variant="gradient"
                gradient={{ from: "royal", to: "purple", deg: 135 }}
                fullWidth
                radius="md"
              >
                Try again
              </Button>
            </>
          )}
        </Stack>
      </Paper>

      <Text size="xs" c="dimmed" ta="center" mt="md" style={{ lineHeight: 1.6 }}>
        You will be redirected automatically once login is complete.
      </Text>
    </Box>
  );
}
