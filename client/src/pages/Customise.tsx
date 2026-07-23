import {
  Title,
  Grid,
  Text,
  Stack,
  Group,
  Switch,
  TextInput,
  Select,
  SegmentedControl,
  Alert,
  Badge,
  useComputedColorScheme,
} from "@mantine/core";

import { useSession } from "../api/authService";
import { SettingsCard } from "../components/SettingsCard";

/**
 * Design placeholder for the /customise page (Design B — grouped sections).
 *
 * This is intentionally NON-FUNCTIONAL and NOT wired into routing or the nav:
 * it exists so the chosen layout is concrete in the code before the dependent
 * feature issues start landing. Every control is disabled; no settings are
 * read or written. Each card is the drop-in spot for one dependent issue —
 * #199 (prompt), #266 (language), #177 (inbox), #58 (profanity), #192
 * (notifications) — which will replace its placeholder control with the real,
 * wired one once #273 hooks up the route.
 */
export default function Customise() {
  const { data: session, isLoading: sessionLoading } = useSession();
  const computedColorScheme = useComputedColorScheme("light", {
    getInitialValueInEffect: true,
  });
  const isDark = computedColorScheme === "dark";

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
              Design preview
            </Badge>
          </Group>
          <Text c="dimmed" fz={15} mb="xl" style={{ maxWidth: "60ch", lineHeight: 1.5 }}>
            Control how your inbox presents itself to the world, grouped by who each setting
            affects. This page is a layout placeholder — the controls are disabled until each
            setting is implemented.
          </Text>

          <Section
            eyebrow="Your public profile"
            help="What visitors see before they send you an anonymous message."
          >
            <Grid.Col span={{ base: 12, lg: 8 }} style={{ display: "flex" }}>
              <SettingsCard
                title="Profile prompt"
                description="The headline shown above your message box. Leave blank to fall back to “Send [you] an anonymous message”."
                isDark={isDark}
              >
                <TextInput
                  placeholder="Ask me anything…"
                  maxLength={100}
                  disabled
                  aria-label="Profile prompt"
                />
              </SettingsCard>
            </Grid.Col>

            <Grid.Col span={{ base: 12, lg: 4 }} style={{ display: "flex" }}>
              <SettingsCard
                title="Message language"
                description="Language of the prompt, share text, and anonymity disclaimer shown to visitors and your audience."
                isDark={isDark}
              >
                <Select
                  data={["English", "Español", "Deutsch", "日本語"]}
                  defaultValue="English"
                  disabled
                  aria-label="Message language"
                />
              </SettingsCard>
            </Grid.Col>
          </Section>

          <Section eyebrow="Message intake" help="Who can reach your inbox, and what gets through.">
            <Grid.Col span={{ base: 12, md: 6 }} style={{ display: "flex" }}>
              <SettingsCard
                title="Inbox"
                description="Turn off to stop receiving new messages while keeping your account, history, and settings intact."
                isDark={isDark}
              >
                <Switch
                  label="Accepting messages"
                  defaultChecked
                  disabled
                  aria-label="Accepting messages"
                />
              </SettingsCard>
            </Grid.Col>

            <Grid.Col span={{ base: 12, md: 6 }} style={{ display: "flex" }}>
              <SettingsCard
                title="Profanity filter"
                description="Screen incoming messages against a wordlist before they reach you. No AI, just a list."
                isDark={isDark}
              >
                <Stack gap="sm">
                  <Switch label="Filter enabled" disabled aria-label="Filter enabled" />
                  <SegmentedControl
                    data={["Reject message", "Mask words"]}
                    defaultValue="Reject message"
                    disabled
                    fullWidth
                  />
                  <Text fz={11} c="purple" fw={600}>
                    Open question (#58): reject vs. mask
                  </Text>
                </Stack>
              </SettingsCard>
            </Grid.Col>
          </Section>

          <Section
            eyebrow="Notifications"
            help="Per-type push controls. Lands here only if #192 grows granular toggles; the single on/off control stays on the Settings page."
            last
          >
            <Grid.Col span={{ base: 12, md: 6, lg: 4 }} style={{ display: "flex" }}>
              <SettingsCard
                title="What sends a push"
                description="The one-tap Enable / Disable control stays on the Settings page; these refine which events notify you."
                isDark={isDark}
              >
                <Stack gap="sm">
                  <Switch label="New message" defaultChecked disabled aria-label="New message" />
                  <Switch label="Reply posted" defaultChecked disabled aria-label="Reply posted" />
                  <Switch label="Daily digest" disabled aria-label="Daily digest" />
                </Stack>
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
