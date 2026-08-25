import { Alert, Box, Button, Paper, PasswordInput, Stack, Text, TextInput } from "@mantine/core";
import { useState } from "react";
import { useNavigate } from "react-router";

import { authKeys, useE2ELogin } from "../../api/authService";
import { queryClient } from "../../api/queryClient";
import { useTranslations } from "../../lib/i18n";
import { resolveApiErrorMessage } from "../../lib/i18n/apiErrors";

/**
 * Bypasses the OAuth redirect with an app password so Playwright can drive a
 * real account on a private PDS. Only built when VITE_E2E_TESTING=true.
 */
export function E2ELoginPanel() {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const messages = useTranslations();
  const e2e = messages.e2eLoginPanel;
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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        onError: (err: any) => {
          setError(resolveApiErrorMessage(err, messages));
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
            {e2e.modeNotice}
          </Text>
          {error && (
            <Alert color="red" withCloseButton onClose={() => setError(null)}>
              {error}
            </Alert>
          )}
          <form onSubmit={onSubmit}>
            <Stack gap="sm">
              <TextInput
                label={e2e.identifier}
                placeholder={e2e.identifierPlaceholder}
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                required
                autoCorrect="off"
                autoCapitalize="none"
                spellCheck={false}
                data-testid="e2e-identifier"
              />
              <PasswordInput
                label={e2e.appPassword}
                placeholder={e2e.appPasswordPlaceholder}
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
                {e2e.signIn}
              </Button>
            </Stack>
          </form>
        </Stack>
      </Paper>
    </Box>
  );
}
