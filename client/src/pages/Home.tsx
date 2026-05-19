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
  Loader,
  Skeleton,
  SimpleGrid,
  Group,
  Anchor,
} from "@mantine/core";
import { IconButterfly } from "@tabler/icons-react";
import { useSession } from "../api/authService";
import React from "react";
import { useSyncMessages } from "../api/messageService";

const ShortcutHint = ({ label, hint }: { label: string; hint: string }) => (
  <Box style={{ display: "flex", justifyContent: "space-between", width: "100%" }}>
    <Text size="xs">{label}</Text>
    <Text size="xs" c="dimmed">{hint.replace("Alt", "Alt/Cmd")}</Text>
  </Box>
);

export default function Home() {
  const { data: sessionData, isLoading } = useSession();
  const syncMessagesMutation = useSyncMessages();
  const isLoggedIn = !!sessionData?.isLoggedIn;

  React.useEffect(() => {
    if (sessionData?.did) {
      syncMessagesMutation.mutate();
    }
  }, [sessionData?.did]);

  return (
    <>
      <Paper p="lg" radius="md" shadow="xs" mb="xl">
        <Title order={1} size="h2" c="deepBlue">
          Navyfragen - Anonymous questions and answers on Bluesky
        </Title>
        <Text c="dimmed" size="lg">
          Receive questions from the web and post the answers directly on
          Bluesky.
        </Text>
      </Paper>

      {isLoading ? (
        <Paper p="xl" radius="md" withBorder shadow="xs">
          <Stack gap="lg">
            <Skeleton height={30} width="60%" />
            <Skeleton height={20} />
            <Skeleton height={20} />
            <Skeleton height={20} />
            <Center mt="md">
              <Skeleton height={42} width={180} radius="md" />
            </Center>
          </Stack>
        </Paper>
      ) : sessionData?.profile ? (
        <Paper p="xl" radius="md" withBorder shadow="xs">
          <Stack gap="md">
            <Center>
              <Title order={2} size="h3" c="deepBlue">
                Good to see you again,{" "}
                {sessionData.profile.displayName || sessionData.profile.handle}!
              </Title>
            </Center>
          </Stack>
          <Center mt="xl">
            <Button
              component={Link}
              to="/messages"
              size="lg"
              radius="md"
              color="deepBlue"
            >
              View Your Messages
            </Button>
          </Center>
        </Paper>
      ) : (
        <Paper p="xl" radius="md" withBorder shadow="xs">
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
          </List>{" "}
          <Center mt="xl">
            <Button
              component={Link}
              to="/login"
              size="lg"
              radius="md"
              color="deepBlue"
            >
              Get Started
            </Button>
          </Center>
        </Paper>
      )}

      <SimpleGrid cols={{ base: 1, sm: 2 }} mt="xl">
        <Paper p="lg" radius="md" withBorder shadow="xs">
          <Text size="sm" fw={600} c="dimmed" mb="sm" tt="uppercase" style={{ letterSpacing: "0.05em" }}>
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

        <Paper p="lg" radius="md" withBorder shadow="xs">
          <Text size="sm" fw={600} c="dimmed" mb="sm" tt="uppercase" style={{ letterSpacing: "0.05em" }}>
            Questions? Feedback?
          </Text>
          <Text size="sm" mb="md">Reach out to us on Bluesky</Text>
          <Anchor
            href="https://bsky.app/profile/navyfragen.app"
            target="_blank"
            rel="noopener noreferrer"
            size="sm"
          >
            <Group gap="xs">
              <IconButterfly size="1rem" stroke={1.5} />
              @navyfragen.app
            </Group>
          </Anchor>
        </Paper>
      </SimpleGrid>
    </>
  );
}
