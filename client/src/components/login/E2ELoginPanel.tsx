import { Alert, Box, Button, Paper, PasswordInput, Stack, Text, TextInput } from "@mantine/core";
import { useState } from "react";
import { useNavigate } from "react-router";

import { authKeys, useE2ELogin } from "../../api/authService";
import { queryClient } from "../../api/queryClient";

/**
 * Bypasses the OAuth redirect with an app password so Playwright can drive a
 * real account on a private PDS. Only built when VITE_E2E_TESTING=true.
 */
export function E2ELoginPanel() {
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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
