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
} from "@mantine/core";
import { useSession } from "../api/authService";

export default function Home() {
  const { data: sessionData, isLoading } = useSession();

  return isLoading ? (
    <>
      <Center>
        <Loader size="xl" mt="xl" />
      </Center>
    </>
  ) : (
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
      {sessionData?.profile ? (
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
            {isLoading ? (
              <Loader size="md" />
            ) : (
              <Button
                component={Link}
                to={sessionData?.isLoggedIn ? "/messages" : "/login"}
                size="lg"
                radius="md"
                color="deepBlue"
              >
                {sessionData?.isLoggedIn ? "View Your Messages" : "Get Started"}
              </Button>
            )}
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
            {isLoading ? (
              <Loader size="md" />
            ) : (
              <Button
                component={Link}
                to={sessionData?.isLoggedIn ? "/messages" : "/login"}
                size="lg"
                radius="md"
                color="deepBlue"
              >
                {sessionData?.isLoggedIn ? "View Your Messages" : "Get Started"}
              </Button>
            )}
          </Center>
        </Paper>
      )}
    </>
  );
}
