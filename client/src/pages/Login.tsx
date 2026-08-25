import { Alert, Box, Button, Center, Text, TextInput, Title } from "@mantine/core";
import { useRef, useState } from "react";
import { useLocation } from "react-router";
import { useHaptic } from "use-haptic";
// Namespace import, not `import { z }` — that one binding comes back undefined
// through Vitest's module runner on Bun. See docs/testing-notes.md.
import * as z from "zod";

import { useLogin } from "../api/authService";
import { AuthPanel } from "../components/AuthPanel";
import * as panelStyles from "../components/AuthPanel.styles";
import { E2ELoginPanel } from "../components/login/E2ELoginPanel";
import { HandleSuggestions } from "../components/login/HandleSuggestions";
import { WinkMark } from "../components/WinkMark";
import { APP_DOMAIN, APP_NAME } from "../lib/brand";
import { useTranslations } from "../lib/i18n";
import { resolveApiErrorMessage } from "../lib/i18n/apiErrors";
import { useHandleSearch } from "../lib/useHandleSearch";
import { BRAND_GRADIENT } from "../styles/tokens";

function LoginForm() {
  const location = useLocation();
  const messages = useTranslations();
  const handleSchema = z
    .string()
    .min(1, { error: messages.loginPage.handleRequired })
    .max(64, { error: messages.loginPage.handleTooLong });
  const search = useHandleSearch();
  const [error, setError] = useState<string | null>(() =>
    new URLSearchParams(location.search).get("error") === "oauth_failed"
      ? messages.loginPage.oauthFailedMessage
      : null
  );
  const [isRedirecting, setIsRedirecting] = useState(false);
  const { mutate: login, isPending } = useLogin();
  const { triggerHaptic } = useHaptic(1);

  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionRef = useRef<HTMLButtonElement>(null);

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!search.isHandleReady) return;
    triggerHaptic();
    setError(null);
    const result = handleSchema.safeParse(search.cleanHandle);
    if (!result.success) {
      setError(result.error.issues[0].message);
      return;
    }
    login(
      { handle: search.cleanHandle },
      {
        onSuccess: (data) => {
          if (data.redirectUrl) {
            setIsRedirecting(true);
            sessionStorage.setItem("newLogin", "true");
            window.location.href = data.redirectUrl;
          }
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        onError: (err: any) => {
          setError(resolveApiErrorMessage(err, messages));
        },
      }
    );
  };

  return (
    <Box maw={480} mx="auto">
      <AuthPanel>
        <Center>
          <WinkMark size={60} sparkle style={panelStyles.mark} />
        </Center>
        <Box ta="center">
          <Title order={1} fw={800} fz={24}>
            {messages.loginPage.logInToPrefix}
            {APP_NAME}
          </Title>
          <Text size="sm" c="dimmed" mt={4}>
            {messages.loginPage.subtitle}
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
            label={messages.loginPage.atmosphereHandle}
            placeholder={messages.loginPage.handlePlaceholder}
            value={search.input}
            onChange={(e) => search.setInput(e.target.value)}
            autoCorrect="off"
            autoCapitalize="none"
            spellCheck={false}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown" && suggestionRef.current) {
                e.preventDefault();
                suggestionRef.current.focus();
              } else if (e.key === "Escape") {
                search.clearSelection();
              }
            }}
            aria-haspopup="listbox"
            aria-autocomplete="list"
          />

          <HandleSuggestions
            search={search}
            suggestionRef={suggestionRef}
            onEscape={() => inputRef.current?.focus()}
          />

          <Button
            type="submit"
            mt="xs"
            fullWidth
            loading={isPending || isRedirecting}
            variant="gradient"
            gradient={BRAND_GRADIENT}
            size="md"
            radius="md"
            style={{
              opacity: search.isHandleReady ? 1 : 0.45,
              cursor: search.isHandleReady ? undefined : "not-allowed",
            }}
          >
            {messages.loginPage.continueButton}
          </Button>
        </form>
      </AuthPanel>

      <Text size="xs" c="dimmed" ta="center" mt="md" style={{ lineHeight: 1.6 }}>
        {messages.loginPage.disclaimerPrefix}
        {APP_NAME}
        {messages.loginPage.disclaimerMiddle}
        <strong>{APP_DOMAIN}</strong>
        {messages.loginPage.disclaimerSuffix}
      </Text>
    </Box>
  );
}

// The build-time constant leaves exactly one branch reachable, so the hooks in
// each panel are never conditional.
export default function Login() {
  if (import.meta.env.VITE_E2E_TESTING === "true") {
    return <E2ELoginPanel />;
  }
  return <LoginForm />;
}
