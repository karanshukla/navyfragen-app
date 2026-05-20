import { Link } from "react-router-dom";
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
} from "@mantine/core";
import { IconBrandGithub } from "@tabler/icons-react";
import { useSession } from "../api/authService";
import React from "react";
import { useSyncMessages } from "../api/messageService";
import { WinkMark } from "../components/WinkMark";

const ShortcutHint = ({ label, hint }: { label: string; hint: string }) => (
  <Box
    style={{
      display: "flex",
      justifyContent: "space-between",
      padding: "5px 0",
    }}
  >
    <Text style={{ fontFamily: "Inter", fontSize: 13 }}>{label}</Text>
    <Text
      style={{
        fontFamily: "JetBrains Mono, monospace",
        fontSize: 12,
        color: "var(--mantine-color-dimmed)",
      }}
    >
      {hint.replace("Alt", "Alt/Cmd")}
    </Text>
  </Box>
);

export default function Home() {
  const { data: sessionData, isLoading } = useSession();
  const syncMessagesMutation = useSyncMessages();
  const isLoggedIn = !!sessionData?.isLoggedIn;
  const computedColorScheme = useComputedColorScheme("light", {
    getInitialValueInEffect: true,
  });

  React.useEffect(() => {
    if (sessionData?.did) {
      syncMessagesMutation.mutate();
    }
  }, [sessionData?.did]);

  const isDark = computedColorScheme === "dark";

  return (
    <>
      <Title
        order={1}
        mb={6}
        style={{
          fontFamily: "Inter",
          fontWeight: 800,
          fontSize: 32,
          letterSpacing: "-0.03em",
          background:
            "linear-gradient(135deg, #3B5BFF 0%, #8B5CF6 55%, #C4B5FD 100%)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          backgroundClip: "text",
          paddingBottom: "0.05em",
        }}
      >
        Navyfragen - Anonymous questions and answers on Bluesky
      </Title>
      <Text
        mb="xl"
        style={{
          fontFamily: "Inter",
          fontSize: 15,
          color: "var(--mantine-color-dimmed)",
        }}
      >
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
            background: isDark ? "rgba(255,255,255,0.06)" : "#F2EBFF",
          }}
        >
          {/* Aurora glow */}
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
                style={{
                  borderRadius: 16,
                  boxShadow: "0 12px 30px -10px rgba(20,18,58,0.4)",
                }}
              />
            </Center>
            <Center>
              <div
                style={{
                  fontFamily: "Inter",
                  fontWeight: 800,
                  fontSize: 26,
                  letterSpacing: "-0.025em",
                  color: "var(--mantine-color-text)",
                }}
              >
                Good to see you again,{" "}
                <span
                  style={{
                    background:
                      "linear-gradient(135deg, #3B5BFF 0%, #8B5CF6 55%, #C4B5FD 100%)",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                    backgroundClip: "text",
                  }}
                >
                  {sessionData.profile.displayName ||
                    sessionData.profile.handle}
                </span>
                !
              </div>
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
                No downloads required, just log in with your Bluesky credentials
                and share your inbox link
              </Text>
            </List.Item>
            <List.Item>
              <Text fw={500}>Spam protection, without captchas</Text>
              <Text c="dimmed">
                Protected by Anubis, a powerful bot detection service
              </Text>
            </List.Item>
            <List.Item>
              <Text fw={500}>Open source</Text>
              <Text c="dimmed">
                Contribute directly to the project, or host your own version if
                you want!
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
        <Paper
          p="lg"
          radius="md"
          withBorder
          style={{ background: isDark ? "rgba(255,255,255,0.06)" : "#F2EBFF" }}
        >
          <Text
            fw={700}
            mb="sm"
            tt="uppercase"
            ff="monospace"
            c="dimmed"
            style={{ fontSize: 11, letterSpacing: "0.1em" }}
          >
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

        <Paper
          p="lg"
          radius="md"
          withBorder
          style={{ background: isDark ? "rgba(255,255,255,0.06)" : "#F2EBFF" }}
        >
          <Text
            fw={700}
            mb="sm"
            tt="uppercase"
            ff="monospace"
            c="dimmed"
            style={{ fontSize: 11, letterSpacing: "0.1em" }}
          >
            Questions? Feedback?
          </Text>
          <Stack gap="sm">
            <div>
              <Text style={{ fontFamily: "Inter", fontSize: 15 }} mb={4}>
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
                  fontFamily: "Inter",
                  fontSize: 15,
                  color: "#8B5CF6",
                  textDecoration: "none",
                }}
              >
                🦋 @navyfragen.app
              </a>
            </div>
            <div>
              <Text style={{ fontFamily: "Inter", fontSize: 15 }} mb={4}>
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
                  fontFamily: "Inter",
                  fontSize: 15,
                  color: "#8B5CF6",
                  textDecoration: "none",
                }}
              >
                <IconBrandGithub size={18} /> GitHub - Navyfragen
              </a>
            </div>
          </Stack>
        </Paper>
      </SimpleGrid>
    </>
  );
}
