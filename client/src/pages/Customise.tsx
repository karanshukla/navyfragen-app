import {
  Alert,
  Badge,
  Button,
  Grid,
  Group,
  Select,
  Skeleton,
  TextInput,
  Title,
} from "@mantine/core";
import { useState, useEffect } from "react";

import { useSession } from "../api/authService";
import { useUserSettings, useUpdateUserSettings, type UserSettings } from "../api/settingsService";
import { ProfileThemeSwatches } from "../components/customise/ProfileThemeSwatches";
import { SettingsSection } from "../components/customise/SettingsSection";
import { SettingsCard } from "../components/SettingsCard";
import { SettingsToggle } from "../components/SettingsToggle";
import { useTranslations } from "../lib/i18n";
import { touchpointLocales } from "../lib/touchpointTranslations";

import * as styles from "./Customise.styles";

const MAX_PROMPT_LENGTH = 100;
const CARD_SPAN = { base: 12, md: 6 };
/** The swatch picker needs the width; on mobile every card is full width anyway. */
const FULL_ROW_SPAN = 12;

/**
 * SQLite sends 0/1 and Postgres sends false/true for the same column.
 *
 * @see [Customise.test.tsx](../tests/pages/Customise.test.tsx) — pins both.
 */
function on(value: number | boolean | null | undefined): boolean {
  return value === 1 || value === true;
}

export default function Customise() {
  const messages = useTranslations();
  const { data: session, isLoading: sessionLoading } = useSession();
  const {
    data: userSettings,
    isLoading: settingsLoading,
    error: settingsError,
    refetch: refetchSettings,
  } = useUserSettings();
  const updateSettings = useUpdateUserSettings();

  // Drafted locally so typing doesn't fire a mutation per keystroke; persisted
  // on blur, then resynced so the trimmed server value is what's shown.
  const [promptDraft, setPromptDraft] = useState<string>(userSettings?.customPrompt ?? "");
  const promptInSync = (userSettings?.customPrompt ?? "") === promptDraft;
  useEffect(() => {
    setPromptDraft(userSettings?.customPrompt ?? "");
  }, [userSettings?.customPrompt]);

  const busy = updateSettings.isPending;

  /** One mutation hook serves every card, so the in-flight payload names the field. */
  const saving = (field: keyof UserSettings) => busy && field in (updateSettings.variables ?? {});

  const loadError = (
    <Alert color="red" title={messages.common.settingsLoadErrorTitle} withCloseButton={false}>
      <Button size="xs" onClick={() => refetchSettings()} variant="light" mt="xs">
        {messages.common.retry}
      </Button>
    </Alert>
  );

  /** Every bottom-anchored control shows the same three states. */
  const field = (skeletonHeight: number, control: React.ReactNode) => {
    if (settingsLoading) return <Skeleton height={skeletonHeight} radius="sm" />;
    if (settingsError) return loadError;
    return control;
  };

  /** Header switches shrink to a track-sized skeleton; the error goes in the body. */
  const headerToggle = (toggle: React.ReactNode) => {
    if (settingsLoading) return <Skeleton height={22} width={38} radius="xl" />;
    if (settingsError) return null;
    return toggle;
  };

  if (!session?.isLoggedIn && !sessionLoading) {
    return (
      <Alert title={messages.common.errorTitle} color="red">
        {messages.common.accessDeniedMessage}
      </Alert>
    );
  }

  return (
    <>
      <Group gap="sm" align="center" mb="xs">
        <Title order={1} style={{ letterSpacing: "-0.03em" }}>
          {messages.customisePage.heading}
        </Title>
        <Badge color="purple" variant="light" radius="sm">
          {messages.customisePage.beta}
        </Badge>
      </Group>

      <SettingsSection
        eyebrow={messages.customisePage.yourPublicProfile}
        help={messages.customisePage.yourPublicProfileHelp}
      >
        <Grid.Col span={CARD_SPAN} style={{ display: "flex" }}>
          <SettingsCard
            title={messages.customisePage.profilePrompt}
            description={messages.customisePage.profilePromptDescription}
          >
            {field(
              36,
              <TextInput
                value={promptDraft}
                onChange={(e) => setPromptDraft(e.target.value.slice(0, MAX_PROMPT_LENGTH))}
                onBlur={() => {
                  if (promptInSync) return;
                  updateSettings.mutate({ customPrompt: promptDraft.trim() || null });
                }}
                placeholder={messages.customisePage.profilePromptPlaceholder}
                maxLength={MAX_PROMPT_LENGTH}
                disabled={busy}
                aria-label={messages.customisePage.profilePrompt}
                description={`${promptDraft.length}/${MAX_PROMPT_LENGTH}`}
                styles={styles.promptCounter}
              />
            )}
          </SettingsCard>
        </Grid.Col>

        <Grid.Col span={CARD_SPAN} style={{ display: "flex" }}>
          <SettingsCard
            title={messages.customisePage.messageLanguage}
            description={messages.customisePage.messageLanguageDescription}
          >
            {field(
              36,
              <Select
                data={touchpointLocales}
                value={
                  touchpointLocales.some((l) => l.value === userSettings?.touchpointLocale)
                    ? userSettings!.touchpointLocale!
                    : "en"
                }
                onChange={(value) => {
                  // allowDeselect={false} — Mantine never emits null/"" here.
                  /* istanbul ignore next */
                  updateSettings.mutate({ touchpointLocale: value || null });
                }}
                disabled={busy}
                allowDeselect={false}
                aria-label={messages.customisePage.messageLanguage}
              />
            )}
          </SettingsCard>
        </Grid.Col>

        <Grid.Col span={FULL_ROW_SPAN} style={{ display: "flex" }}>
          <SettingsCard
            title={messages.customisePage.profileCardColour}
            description={messages.customisePage.profileCardColourDescription}
          >
            {field(
              56,
              <ProfileThemeSwatches
                value={userSettings?.profileCardTheme ?? null}
                disabled={busy}
                onPick={(value) => updateSettings.mutate({ profileCardTheme: value })}
              />
            )}
          </SettingsCard>
        </Grid.Col>
      </SettingsSection>

      <SettingsSection
        eyebrow={messages.customisePage.messageIntake}
        help={messages.customisePage.messageIntakeHelp}
        last
      >
        <Grid.Col span={CARD_SPAN} style={{ display: "flex" }}>
          <SettingsCard
            title={messages.customisePage.inbox}
            description={messages.customisePage.inboxDescription}
            control={headerToggle(
              <SettingsToggle
                label={messages.customisePage.inbox}
                checked={on(userSettings?.inboxEnabled)}
                onChange={(checked) => updateSettings.mutate({ inboxEnabled: checked })}
                disabled={busy}
                saving={saving("inboxEnabled")}
              />
            )}
          >
            {settingsError ? loadError : null}
          </SettingsCard>
        </Grid.Col>

        <Grid.Col span={CARD_SPAN} style={{ display: "flex" }}>
          <SettingsCard
            title={messages.customisePage.profanityFilter}
            description={messages.customisePage.profanityFilterDescription}
            control={headerToggle(
              <SettingsToggle
                label={messages.customisePage.profanityFilter}
                checked={on(userSettings?.profanityFilterEnabled)}
                onChange={(checked) => updateSettings.mutate({ profanityFilterEnabled: checked })}
                disabled={busy}
                saving={saving("profanityFilterEnabled")}
              />
            )}
          >
            {settingsError ? loadError : null}
          </SettingsCard>
        </Grid.Col>
      </SettingsSection>
    </>
  );
}
