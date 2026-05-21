import {
  Button,
  List,
  Text,
  Title,
  Paper,
  Stack,
  Center,
  Box,
  Skeleton,
  SimpleGrid,
  useComputedColorScheme,
  Divider,
} from "@mantine/core";
import { IconBrandGithub, IconButterfly } from "@tabler/icons-react";
import React from "react";
import { Link } from "react-router-dom";

import { useSession } from "../api/authService";
import { useSyncMessages } from "../api/messageService";
import { WinkMark } from "../components/WinkMark";
import { surfaceBg } from "../styles/tokens";

// Gradient text — reused for the page title and the greeting name span
const gradientTextStyle = {
  background: "var(--nf-grad-hero)",
  WebkitBackgroundClip: "text",
  WebkitTextFillColor: "transparent",
  backgroundClip: "text",
} as const;

function ShortcutHint({ label, hint }: { label: string; hint: string }) {
  return (
    <Box style={{ display: "flex", justifyContent: "space-between", padding: "5px 0" }}>
      <Text fz={13}>{label}</Text>
      <Text ff="monospace" fz={12} c="dimmed">
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
  }, [sessionData?.did]);

  return (
    <>
      <Title
        order={1}
        mb={6}
        style={{
          ...gradientTextStyle,
          letterSpacing: "-0.03em",
          paddingBottom: "0.05em",
        }}
      >
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
            position: "relative",
            overflow: "hidden",
            background: surfaceBg(isDark),
          }}
        >
          {/* Subtle radial glow from top center */}
          <Box
            style={{
              position: "absolute",
              inset: 0,
              background: isDark
                ? "radial-gradient(ellipse 60% 100% at 50% 0%, rgba(139,92,246,0.15), transparent 70%)"
                : "radial-gradient(ellipse 60% 100% at 50% 0%, rgba(196,181,253,0.4), transparent 70%)",
              pointerEvents: "none",
            }}
          />
          <Stack gap="md" style={{ position: "relative" }}>
            <Center>
              <WinkMark
                size={64}
                sparkle
                style={{ borderRadius: 16, boxShadow: "0 12px 30px -10px rgba(20,18,58,0.4)" }}
              />
            </Center>
            <Center>
              <Text
                fw={800}
                fz={26}
                style={{ letterSpacing: "-0.025em" }}
              >
                Good to see you again,{" "}
                <span style={gradientTextStyle}>
                  {sessionData.profile.displayName || sessionData.profile.handle}
                </span>
                !
              </Text>
            </Center>
          </Stack>
          <Center mt="xl" style={{ position: "relative" }}>
            <Button
              component={Link}
              to="/messages"
              size="lg"
              radius="md"
              variant="gradient"
              gradient={{ from: "royal", to: "purple", deg: 135 }}
            >
              View Your Messages
            </Button>
          </Center>
        </Paper>
      ) : (
        <Paper p="xl" radius="lg" withBorder>
          <List spacing="md" size="md">
            <List.Item>
              <Text fw={500}>Fast and free</Text>
              <Text c="dimmed">
                No downloads required, just log in with your Bluesky credentials and share your inbox link
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
          <Text fw={700} mb="sm" tt="uppercase" ff="monospace" c="dimmed" fz={11} style={{ letterSpacing: "0.1em" }}>
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
          <Text fw={700} mb="sm" tt="uppercase" ff="monospace" c="dimmed" fz={11} style={{ letterSpacing: "0.1em" }}>
            Questions? Feedback?
          </Text>
          <Stack gap="sm">
            <div>
              <Text fz={15} mb={4}>Reach out on Bluesky</Text>
              <a
                href="https://bsky.app/profile/navyfragen.app"
                target="_blank"
                rel="noopener noreferrer"
                style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 15, color: "var(--nf-purple)", textDecoration: "none" }}
              >
                <IconButterfly size={18} /> @navyfragen.app
              </a>
            </div>
            <div>
              <Text fz={15} mb={4}>Submit an issue on GitHub</Text>
              <a
                href="https://github.com/karanshukla/navyfragen-app"
                target="_blank"
                rel="noopener noreferrer"
                style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 15, color: "var(--nf-purple)", textDecoration: "none" }}
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
