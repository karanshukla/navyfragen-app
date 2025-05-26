import { useEffect, useState } from "react";
import {
  Container,
  Title,
  Text,
  Paper,
  Stack,
  Loader,
  Center,
  Alert,
} from "@mantine/core";

// Use the API URL from environment variable
const API_URL = import.meta.env.VITE_API_URL || "";

type SessionResponse = {
  isLoggedIn: boolean;
  profile: any;
  did: string | null;
};

export default function Messages() {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [session, setSession] = useState<SessionResponse | null>(null);
  const [welcomeMessage, setWelcomeMessage] = useState<boolean>(false);

  // Show a welcome message for newly logged-in users
  useEffect(() => {
    // If we were just redirected after login, show a welcome message
    const isNewLogin = sessionStorage.getItem("newLogin");
    if (isNewLogin === "true") {
      setWelcomeMessage(true);
      sessionStorage.removeItem("newLogin");
    }
  }, []); // Fetch user session data
  useEffect(() => {
    const fetchSession = async () => {
      try {
        // Get the token from URL parameters if present
        const params = new URLSearchParams(window.location.search);
        const token = params.get("token");

        if (token) {
          // Save token in localStorage for future requests
          localStorage.setItem("auth_token", token);

          // Clean up URL by removing the token parameter
          const newUrl = window.location.pathname;
          window.history.replaceState({}, document.title, newUrl);
        }

        // Get the token from localStorage
        const storedToken = localStorage.getItem("auth_token");

        // Request options with token in Authorization header
        const options: RequestInit = {
          method: "GET",
          headers: {
            "Cache-Control": "no-cache",
          },
        };

        // Add token to the URL if available
        let url = `${API_URL}/api/session`;
        if (storedToken) {
          url += `?token=${storedToken}`;
        }

        const res = await fetch(url, options);

        if (!res.ok) {
          throw new Error(`Server responded with status: ${res.status}`);
        }

        const data = await res.json();
        console.log("Session data:", data);
        // If logged in, ensure token is saved
        if (data.isLoggedIn && data.did) {
          // Keep using the existing token if available
          if (storedToken) {
            localStorage.setItem("auth_token", storedToken);
          }
        }

        setSession(data);
        setIsLoading(false);
      } catch (err) {
        setError("Failed to load session data");
        setIsLoading(false);
        console.error("Session error:", err);
      }
    };

    fetchSession();
  }, []);

  if (isLoading) {
    return (
      <Center h={200}>
        <Loader size="lg" />
      </Center>
    );
  }

  // Show login prompt if not logged in
  if (!session?.isLoggedIn) {
    return (
      <Container>
        <Alert color="red" title="Not logged in">
          You need to log in to view your messages.
        </Alert>
      </Container>
    );
  }
  return (
    <Container>
      <Title mb="md">Your Messages</Title>
      {error && <Alert color="red">{error}</Alert>}

      {welcomeMessage && (
        <Alert
          color="green"
          title="Welcome!"
          mb="md"
          withCloseButton
          onClose={() => setWelcomeMessage(false)}
        >
          You've successfully logged in with your Bluesky account.
        </Alert>
      )}

      {session?.profile ? (
        <Paper p="md" withBorder mb="lg">
          <Text fw={500} size="lg">
            Hi, {session.profile.displayName || "there"}!
          </Text>
          <Text c="dimmed" size="sm" mb="md">
            {session.did}
          </Text>
        </Paper>
      ) : null}

      {/* Message list placeholder */}
      <Stack gap="md">
        <Paper p="md" withBorder>
          <Text fw={500} size="md" mb="sm">
            Inbox
          </Text>
          <Text c="dimmed" size="sm" mb="md">
            You don't have any messages yet. Share your inbox link to start
            receiving questions.
          </Text>
        </Paper>
      </Stack>
    </Container>
  );
}
