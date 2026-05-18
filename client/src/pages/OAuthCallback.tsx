import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Container, Center, Loader, Alert, Title, Stack } from "@mantine/core";
import { apiClient } from "../api/apiClient";
import { authKeys } from "../api/authService";

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

  if (loading) {
    return (
      <Container>
        <Center>
          <Stack align="center" gap="md">
            <Title order={3}>Completing OAuth Login...</Title>
            <Loader />
          </Stack>
        </Center>
      </Container>
    );
  }

  if (error) {
    return (
      <Container>
        <Alert color="red" title="OAuth Error">
          {error}
        </Alert>
      </Container>
    );
  }

  return null;
}
