import {
  Button,
  Group,
  List,
  Text,
  ThemeIcon,
  Title,
  Paper,
  Stack,
  Center,
  Box,
} from "@mantine/core";
import { IconCheck } from "@tabler/icons-react";

export default function Home() {
  return (
    <>
      <Paper p="lg" radius="md" withBorder shadow="sm" mb="xl">
        <Title order={1} size="h2" c="deepBlue">
          Navyfragen - Anonymous questions and answers on BlueSky
        </Title>
        <Text c="dimmed" size="lg">
          Receive questions from the web and post the answers directly on
          BlueSky.
        </Text>
      </Paper>

      <Paper p="xl" radius="md" withBorder shadow="xs">
        <List
          spacing="md"
          size="md"
          icon={
            <ThemeIcon color="deepBlue" size={24} radius="xl">
              <IconCheck size="1rem" />
            </ThemeIcon>
          }
        >
          <List.Item>
            <Text fw={500}>Fast and free</Text>
            <Text c="dimmed">
              No downloads required, just log in with your BlueSky credentials
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
          <Button size="lg" radius="md" color="deepBlue">
            Get Started
          </Button>
        </Center>
      </Paper>
    </>
  );
}
