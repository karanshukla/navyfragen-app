import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
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

// Use the API URL from environment variable
const API_URL = import.meta.env.VITE_API_URL || "";

export default function Home() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  // Check if user is logged in
  useEffect(() => {
    fetch(`${API_URL}/api/session`, {
      credentials: "include",
    })
      .then((res) => res.json())
      .then((data) => {
        setIsLoggedIn(data.isLoggedIn);
      })
      .catch((err) => console.error("Failed to check login status:", err));
  }, []);

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
        <List spacing="md" size="md">
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
          <Button
            component={Link}
            to={isLoggedIn ? "/messages" : "/login"}
            size="lg"
            radius="md"
            color="deepBlue"
          >
            {isLoggedIn ? "View Your Messages" : "Get Started"}
          </Button>
        </Center>
      </Paper>
    </>
  );
}
