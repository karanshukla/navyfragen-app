import {
  Title,
  Grid,
  Text,
  Stack,
  Group,
  Alert,
  Button,
  Select,
  Switch,
  TextInput,
  Skeleton,
  Badge,
} from "@mantine/core";
import { useState, useEffect } from "react";
import { useComputedColorScheme } from "@mantine/core";

import { useSession } from "../api/authService";
import { useUserSettings, useUpdateUserSettings } from "../api/settingsService";
import { SettingsCard } from "../components/SettingsCard";
import { profileCardThemes } from "../lib/themes";
import { touchpointLocales } from "../lib/touchpointTranslations";

const MAX_PROMPT_LENGTH = 100;

/**
 * Coerce a `user_settings` boolean column to a real boolean. The Kysely row
 * type says `number | boolean`: SQLite returns 0/1, Postgres returns false/true
 * for a `boolean` column. Treat anything that isn't 1/true as off.
 */
function on(value: number | boolean | null | undefined): boolean {
  return value === 1 || value === true;
}

export default function Customise() {
  const isDark = useComputedColorScheme("light", { getInitialValueInEffect: true }) === "dark";
  const { data: session, isLoading: sessionLoading } = useSession();
  const {
    data: userSettings,
    isLoading: settingsLoading,
    error: settingsError,
    refetch: refetchSettings,
  } = useUserSettings();
  const updateSettings = useUpdateUserSettings();

  // Local draft for the prompt text so typing doesn't fire a mutation per
  // keystroke; persisted on blur when the value actually changed. Resyncs from
  // the server value once it loads (async) and after a successful mutation so
  // the trimmed/persisted result is reflected.
  const [promptDraft, setPromptDraft] = useState<string>(userSettings?.customPrompt ?? "");
  const promptInSync = (userSettings?.customPrompt ?? "") === promptDraft;
  useEffect(() => {
    setPromptDraft(userSettings?.customPrompt ?? "");
  }, [userSettings?.customPrompt]);

  const settingsLoadError = (
    <Alert color="red" title="Failed to load settings" withCloseButton={false}>
      <Button size="xs" onClick={() => refetchSettings()} variant="light" mt="xs">
        Retry
      </Button>
    </Alert>
  );

  const busy = updateSettings.isPending;

  return (
    <>
      {!session?.isLoggedIn && !sessionLoading ? (
        <Alert title="Error" color="red">
          You cannot access this page without logging in.
        </Alert>
      ) : (
        <>
          <Group gap="sm" align="center" mb="xs">
            <Title order={1} style={{ letterSpacing: "-0.03em" }}>
              Customise
            </Title>
            <Badge color="purple" variant="light" radius="sm">
              Beta
            </Badge>
          </Group>
          <Text c="dimmed" fz={15} mb="xl" style={{ maxWidth: "60ch", lineHeight: 1.5 }}>
            Control how your inbox presents itself to the world, grouped by who each setting
            affects.
          </Text>

          <Section
            eyebrow="Your public profile"
            help="What visitors see before they send you an anonymous message."
          >
            <Grid.Col span={{ base: 12, md: 6, lg: 4 }} style={{ display: "flex" }}>
              <SettingsCard
                title="Profile prompt"
                description="The headline shown above your message box. Leave blank to fall back to “Send [you] an anonymous message”."
                isDark={isDark}
              >
                {settingsLoading ? (
                  <Skeleton height={36} radius="sm" />
                ) : settingsError ? (
                  settingsLoadError
                ) : (
                  <TextInput
                    value={promptDraft}
                    onChange={(e) => setPromptDraft(e.target.value.slice(0, MAX_PROMPT_LENGTH))}
                    onBlur={() => {
                      if (promptInSync) return;
                      updateSettings.mutate({ customPrompt: promptDraft.trim() || null });
                    }}
                    placeholder="Ask me anything…"
                    maxLength={MAX_PROMPT_LENGTH}
                    disabled={busy}
                    aria-label="Profile prompt"
                    description={`${promptDraft.length}/${MAX_PROMPT_LENGTH}`}
                  />
                )}
              </SettingsCard>
            </Grid.Col>

            <Grid.Col span={{ base: 12, md: 6, lg: 4 }} style={{ display: "flex" }}>
              <SettingsCard
                title="Message language"
                description="Language of the prompt, share text, and anonymity disclaimer shown to visitors and your audience."
                isDark={isDark}
              >
                {settingsLoading ? (
                  <Skeleton height={36} radius="sm" />
                ) : settingsError ? (
                  settingsLoadError
                ) : (
                  <Select
                    data={touchpointLocales}
                    value={
                      touchpointLocales.some((l) => l.value === userSettings?.touchpointLocale)
                        ? userSettings!.touchpointLocale!
                        : "en"
                    }
                    onChange={(value) => updateSettings.mutate({ touchpointLocale: value || null })}
                    disabled={busy}
                    allowDeselect={false}
                    aria-label="Message language"
                  />
                )}
              </SettingsCard>
            </Grid.Col>

            <Grid.Col span={{ base: 12, md: 6, lg: 4 }} style={{ display: "flex" }}>
              <SettingsCard
                title="Profile card colour"
                description="The colour treatment of your ask card. Curated presets keep the text and button legible on every option."
                isDark={isDark}
              >
                {settingsLoading ? (
                  <Skeleton height={56} radius="sm" />
                ) : settingsError ? (
                  settingsLoadError
                ) : (
                  <ProfileThemeSwatches
                    value={userSettings?.profileCardTheme ?? null}
                    disabled={busy}
                    onPick={(value) => updateSettings.mutate({ profileCardTheme: value })}
                  />
                )}
              </SettingsCard>
            </Grid.Col>
          </Section>

          <Section
            eyebrow="Message intake"
            help="Who can reach your inbox, and what gets through."
            last
          >
            <Grid.Col span={{ base: 12, md: 6, lg: 4 }} style={{ display: "flex" }}>
              <SettingsCard
                title="Inbox"
                description="Turn off to stop receiving new messages while keeping your account, history, and settings intact. Visitors see a “not accepting messages” state."
                isDark={isDark}
              >
                {settingsLoading ? (
                  <Skeleton height={28} radius="sm" />
                ) : settingsError ? (
                  settingsLoadError
                ) : (
                  <Switch
                    label="Accepting messages"
                    checked={on(userSettings?.inboxEnabled)}
                    onChange={(e) =>
                      updateSettings.mutate({ inboxEnabled: e.currentTarget.checked })
                    }
                    disabled={busy}
                    aria-label="Accepting messages"
                  />
                )}
              </SettingsCard>
            </Grid.Col>

            <Grid.Col span={{ base: 12, md: 6, lg: 4 }} style={{ display: "flex" }}>
              <SettingsCard
                title="Profanity filter"
                description="When on, incoming messages are screened against a wordlist. Flagged messages are silently dropped — the sender sees a success response, but the message never reaches your inbox."
                isDark={isDark}
              >
                {settingsLoading ? (
                  <Skeleton height={28} radius="sm" />
                ) : settingsError ? (
                  settingsLoadError
                ) : (
                  <Switch
                    label="Filter enabled"
                    checked={on(userSettings?.profanityFilterEnabled)}
                    onChange={(e) =>
                      updateSettings.mutate({
                        profanityFilterEnabled: e.currentTarget.checked,
                      })
                    }
                    disabled={busy}
                    aria-label="Filter enabled"
                  />
                )}
              </SettingsCard>
            </Grid.Col>
          </Section>
        </>
      )}
    </>
  );
}

interface SectionProps {
  eyebrow: string;
  help: string;
  last?: boolean;
  children: React.ReactNode;
}

function Section({ eyebrow, help, last, children }: SectionProps) {
  return (
    <div style={{ marginBottom: last ? 0 : 34 }}>
      <Text tt="uppercase" fw={700} fz={12} c="dimmed" style={{ letterSpacing: "0.05em" }}>
        {eyebrow}
      </Text>
      <Text c="dimmed" fz={13} mb="md">
        {help}
      </Text>
      <Grid style={{ gap: "var(--mantine-spacing-md)" }}>{children}</Grid>
    </div>
  );
}

/**
 * Swatch selector for the ask-card colour preset, mirroring the ThemeCard
 * pattern already used for image-export themes in Messages.tsx (selected =
 * blue tint + border), but lighter-weight since the preview is just a gradient
 * fill, not a multi-branch card mockup.
 */
function ProfileThemeSwatches({
  value,
  disabled,
  onPick,
}: {
  value: string | null;
  disabled: boolean;
  onPick: (value: string) => void;
}) {
  return (
    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
      {Object.entries(profileCardThemes).map(([themeValue, theme]) => {
        const selected = (value ?? "royal") === themeValue;
        return (
          <button
            key={themeValue}
            type="button"
            onClick={() => onPick(themeValue)}
            disabled={disabled}
            aria-pressed={selected}
            aria-label={`${theme.label} theme`}
            style={{
              background: selected ? "rgba(59,91,255,0.12)" : "transparent",
              border: selected
                ? "1.5px solid #3B5BFF"
                : "1.5px solid var(--mantine-color-default-border)",
              borderRadius: 10,
              padding: 8,
              cursor: disabled ? "default" : "pointer",
              display: "flex",
              flexDirection: "column",
              gap: 6,
              flex: "1 1 90px",
              minWidth: 90,
            }}
          >
            <div
              style={{
                aspectRatio: "4/3",
                borderRadius: 5,
                background: theme.gradient,
              }}
            />
            <Text size="xs" fw={600} ta="center" style={{ color: "var(--mantine-color-text)" }}>
              {theme.label}
            </Text>
          </button>
        );
      })}
    </div>
  );
}
