import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import {
  Box,
  Center,
  Loader,
  Stack,
  Text,
  Title,
  Paper,
  Button,
} from "@mantine/core";
import { Link } from "react-router-dom";
import { apiClient } from "../api/apiClient";
import { authKeys } from "../api/authService";
import { WinkMark } from "../components/WinkMark";

export default function OAuthCallback() {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

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
        style={{
          background: "linear-gradient(135deg, #1E1B4B 0%, #3B2E78 50%, #6B3FD4 100%)",
          border: "1px solid rgba(255,255,255,0.08)",
          color: "#FDF8FF",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <Box style={{ position: "absolute", right: -28, top: -28, opacity: 0.08, pointerEvents: "none" }}>
          <WinkMark size={160} sparkle={false} aria-hidden />
        </Box>

        <Stack gap="md" align="center" style={{ position: "relative" }}>
          <WinkMark size={60} sparkle={loading} style={{ borderRadius: 16 }} />

          {loading ? (
            <>
              <Title order={2} style={{ color: "#FDF8FF", fontWeight: 800, fontSize: 24, textAlign: "center" }}>
                Logging you in…
              </Title>
              <Text size="sm" style={{ color: "rgba(253,248,255,0.65)", textAlign: "center" }}>
                Completing your Bluesky authentication
              </Text>
              <Loader color="white" size="sm" />
            </>
          ) : (
            <>
              <Title order={2} style={{ color: "#FCA5A5", fontWeight: 800, fontSize: 24, textAlign: "center" }}>
                Login failed
              </Title>
              <Text size="sm" style={{ color: "rgba(253,248,255,0.65)", textAlign: "center" }}>
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
