import {
  Avatar,
  Button,
  CopyButton,
  Divider,
  Group,
  List,
  Paper,
  SimpleGrid,
  Skeleton,
  Stack,
  Center,
  Box,
  Text,
  Title,
  Tooltip,
  useComputedColorScheme,
} from "@mantine/core";
import { IconBrandGithub, IconButterfly, IconClipboard, IconShare } from "@tabler/icons-react";
import React from "react";
import { Link } from "react-router-dom";

import { useSession } from "../api/authService";
import { useSyncMessages } from "../api/messageService";
import { WinkMark } from "../components/WinkMark";
import { surfaceBg } from "../styles/tokens";

const shortlinkurl = import.meta.env.VITE_SHORTLINK_URL || "localhost:5173/profile";

function ShortcutHint({ label, hint }: { label: string; hint: string }) {
  return (
    <Box
      style={{
        display: "flex",
        justifyContent: "space-between",
        padding: "5px 0",
      }}
    >
      <Text fz={13}>{label}</Text>
      <Text fz={12} c="dimmed">
        {hint.replace("Alt", "Alt/Cmd")}
      </Text>
    </Box>
  );
}

export default function Home() {
  const { data: sessionData, isLoading } = useSession();
  const syncMessagesMutation = useSyncMessages();
  const isDark = useComputedColorScheme("light", { getInitialValueInEffect: true }) === "dark";
  const isLoggedIn = !!sessionData?.isLoggedIn;

  React.useEffect(() => {
    if (sessionData?.did) {
      syncMessagesMutation.mutate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionData?.did]);

  return (
    <>
      <Title order={1} mb={6} style={{ letterSpacing: "-0.03em" }}>
        Navyfragen - Anonymous questions and answers on Bluesky
      </Title>
      <Text mb="xl" fz={15} c="dimmed">
        Receive questions from the web and post the answers directly on Bluesky.
      </Text>

      {isLoading ? (
        <Paper p="xl" radius="lg" withBorder>
          <Stack gap="lg">
            <Skeleton height={30} width="60%" />
            <Skeleton height={20} />
            <Skeleton height={20} />
            <Center mt="md">
              <Skeleton height={42} width={180} radius="md" />
            </Center>
          </Stack>
        </Paper>
      ) : sessionData?.profile ? (
        <Paper
          radius="lg"
          withBorder
          style={{
            padding: "40px 24px",
            textAlign: "center",
            background: surfaceBg(isDark),
          }}
        >
          <Stack gap="md">
            <Center>
              <Avatar
                src={sessionData.profile.avatar ?? undefined}
                alt={sessionData.profile.displayName || sessionData.profile.handle}
                size={84}
                radius="xl"
                style={{
                  border: "3px solid rgba(255,255,255,0.25)",
                }}
              >
                <WinkMark size={60} sparkle={false} aria-hidden />
              </Avatar>
            </Center>
            <Center>
              <Text fw={800} fz={26} style={{ letterSpacing: "-0.025em" }}>
                Good to see you again,{" "}
                <Text component="span" c="royal" fw={800} inherit>
                  {sessionData.profile.displayName || sessionData.profile.handle}
                </Text>
                !
              </Text>
            </Center>
          </Stack>
          <Center mt="xl" style={{ position: "relative" }}>
            <Group gap="xs" align="center" wrap="wrap" justify="center">
              <Button
                component={Link}
                to="/messages"
                size="lg"
                radius="md"
                style={{
                  background: "var(--nf-grad-hero)",
                  color: "white",
                  border: "none",
                }}
              >
                View Your Messages
              </Button>
              <CopyButton value={`https://${shortlinkurl}/${sessionData.profile.handle}`}>
                {({ copied, copy }) => (
                  <Tooltip label={copied ? "Copied!" : "Copy profile link"} withArrow>
                    <Button
                      onClick={copy}
                      size="sm"
                      radius="xl"
                      variant="dark"
                      leftSection={<IconClipboard size={14} />}
                    >
                      {copied ? "Copied!" : "Copy Link"}
                    </Button>
                  </Tooltip>
                )}
              </CopyButton>
              <Button
                size="sm"
                radius="xl"
                variant="dark"
                leftSection={<IconShare size={14} />}
                onClick={async () => {
                  const url = `https://${shortlinkurl}/${sessionData.profile!.handle}`;
                  if (navigator.share) {
                    try {
                      await navigator.share({
                        title: "Send me anonymous messages on Navyfragen!",
                        url,
                      });
                    } catch {
                      /* v8 ignore next */
                    }
                  } else if (navigator.clipboard) {
                    await navigator.clipboard.writeText(url);
                  }
                }}
              >
                Share
              </Button>
            </Group>
          </Center>
        </Paper>
      ) : (
        <Paper p="xl" radius="lg" withBorder style={{ background: surfaceBg(isDark) }}>
          <List spacing="md" size="md">
            <List.Item>
              <Text fw={500}>Fast and free</Text>
              <Text c="dimmed">
                No downloads required, just log in with your Bluesky credentials and share your
                inbox link
              </Text>
            </List.Item>
            <List.Item>
              <Text fw={500}>Spam protection, without captchas</Text>
              <Text c="dimmed">Protected by Anubis, a powerful bot detection service</Text>
            </List.Item>
            <List.Item>
              <Text fw={500}>Open source</Text>
              <Text c="dimmed">
                Contribute directly to the project, or host your own version if you want!
              </Text>
            </List.Item>
          </List>
          <Center mt="xl">
            <Button
              component={Link}
              to="/login"
              size="lg"
              radius="md"
              variant="gradient"
              gradient={{ from: "royal", to: "purple", deg: 135 }}
            >
              Get Started
            </Button>
          </Center>
        </Paper>
      )}

      <SimpleGrid cols={{ base: 1, sm: 2 }} mt="md">
        <Paper p="lg" radius="md" withBorder style={{ background: surfaceBg(isDark) }}>
          <Text fw={600} mb="sm" c="dimmed" fz={12}>
            Keyboard Shortcuts
          </Text>
          <Stack gap={6}>
            <ShortcutHint label="Home" hint="Alt+H" />
            {isLoggedIn ? (
              <>
                <ShortcutHint label="Messages" hint="Alt+M" />
                <ShortcutHint label="Settings" hint="Alt+S" />
                <ShortcutHint label="Focus/Cycle Cards" hint="Alt+R" />
                <ShortcutHint label="Navigate Cards" hint="↑/↓" />
              </>
            ) : (
              <ShortcutHint label="Login" hint="Alt+L" />
            )}
          </Stack>
        </Paper>

        <Paper p="lg" radius="md" withBorder style={{ background: surfaceBg(isDark) }}>
          <Text fw={600} mb="sm" c="dimmed" fz={12}>
            Questions? Feedback?
          </Text>
          <Stack gap="sm">
            <div>
              <Text fz={15} mb={4}>
                Reach out on Bluesky
              </Text>
              <a
                href="https://bsky.app/profile/navyfragen.app"
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  fontSize: 15,
                  color: isDark ? "var(--nf-lavender)" : "var(--nf-purple)",
                  textDecoration: "none",
                }}
              >
                <IconButterfly size={18} /> @navyfragen.app
              </a>
            </div>
            <div>
              <Text fz={15} mb={4}>
                Submit an issue on GitHub
              </Text>
              <a
                href="https://github.com/karanshukla/navyfragen-app"
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  fontSize: 15,
                  color: isDark ? "var(--nf-lavender)" : "var(--nf-purple)",
                  textDecoration: "none",
                }}
              >
                <IconBrandGithub size={18} /> GitHub - Navyfragen
              </a>
            </div>
            <Divider />
            <Text fz={13}>
              Disclaimer: Please follow Bluesky&apos;s ToS. Cookies are used to keep you logged in.
              This app does not include any moderation.
            </Text>
          </Stack>
        </Paper>
      </SimpleGrid>
    </>
  );
}
