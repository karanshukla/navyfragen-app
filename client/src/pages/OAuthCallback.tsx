import { Box, Button, Loader, Text, Title } from "@mantine/core";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Link, useNavigate, useLocation } from "react-router";

import { apiClient } from "../api/apiClient";
import { authKeys } from "../api/authService";
import { AuthPanel } from "../components/AuthPanel";
import * as panelStyles from "../components/AuthPanel.styles";
import { WinkMark } from "../components/WinkMark";
import { useTranslations } from "../lib/i18n";
import { resolveApiErrorMessage } from "../lib/i18n/apiErrors";
import { BRAND_GRADIENT, dangerText } from "../styles/tokens";

export default function OAuthCallback() {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const messages = useTranslations();
  const token = new URLSearchParams(location.search).get("oauth_token");
  const [error, setError] = useState<string | null>(
    !token ? messages.oauthCallback.missingToken : null
  );
  const [loading, setLoading] = useState(!!token);

  useEffect(() => {
    if (!token) return;
    apiClient
      .post<{ success: boolean }, { oauth_token: string }>("/oauth/consume", {
        oauth_token: token,
      })
      .then(async () => {
        await queryClient.refetchQueries({ queryKey: authKeys.session });
        navigate("/messages");
      })
      .catch((err) => {
        setError(resolveApiErrorMessage(err, messages));
        setLoading(false);
      });
  }, [token, navigate, queryClient]);

  return (
    <Box maw={480} mx="auto" mt="xl">
      <AuthPanel>
        <Box ta="center">
          <WinkMark size={60} sparkle={loading} style={panelStyles.mark} />
        </Box>

        {loading ? (
          <>
            <Title order={2} fw={800} fz={24} ta="center">
              {messages.oauthCallback.loggingIn}
            </Title>
            <Text size="sm" c="dimmed" ta="center">
              {messages.oauthCallback.completingAuth}
            </Text>
            <Box ta="center">
              <Loader size="sm" />
            </Box>
          </>
        ) : (
          <>
            <Title order={2} fw={800} fz={24} ta="center" style={{ color: dangerText }}>
              {messages.oauthCallback.loginFailed}
            </Title>
            <Text size="sm" c="dimmed" ta="center">
              {error}
            </Text>
            <Button
              component={Link}
              to="/login"
              variant="gradient"
              gradient={BRAND_GRADIENT}
              fullWidth
              radius="md"
            >
              {messages.oauthCallback.tryAgain}
            </Button>
          </>
        )}
      </AuthPanel>

      <Text size="xs" c="dimmed" ta="center" mt="md" style={{ lineHeight: 1.6 }}>
        {messages.oauthCallback.redirectNotice}
      </Text>
    </Box>
  );
}
