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
  Button,
  Group,
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
  const [messages, setMessages] = useState<any[]>([]);

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
        // Fetch messages if logged in
        if (data.isLoggedIn && data.did) {
          fetchMessages(data.did);
        }
      } catch (err) {
        setError("Failed to load session data");
        setIsLoading(false);
        console.error("Session error:", err);
      }
    };
    const fetchMessages = async (did: string) => {
      try {
        setIsLoading(true);
        setError(null);
        const res = await fetch(
          `${API_URL}/api/messages/${encodeURIComponent(did)}`
        );
        if (!res.ok) throw new Error(`Failed to fetch messages: ${res.status}`);
        const data = await res.json();
        setMessages(data.messages || []);
        setIsLoading(false);
      } catch (err) {
        setError("Failed to load messages");
        setIsLoading(false);
      }
    };
    fetchSession();
  }, []);

  // Add example messages for testing
  const addExampleMessages = async () => {
    if (!session?.did) return;
    setIsLoading(true);
    setError(null);
    try {
      // Example: POST to a new endpoint to add test messages (you must implement this endpoint in your backend)
      const res = await fetch(`${API_URL}/api/messages/example`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipient: session.did }),
      });
      if (!res.ok) throw new Error("Failed to add example messages");
      // Re-fetch messages after adding
      const data = await res.json();
      setMessages(data.messages || []);
    } catch (err) {
      setError("Failed to add example messages");
    } finally {
      setIsLoading(false);
    }
  };

  // Respond to a message
  const [respondingTid, setRespondingTid] = useState<string | null>(null);
  const [responseText, setResponseText] = useState<string>("");

  const handleDelete = async (tid: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/api/messages/${tid}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete message");
      setMessages((msgs) => msgs.filter((msg) => msg.tid !== tid));
    } catch (err) {
      setError("Failed to delete message");
    } finally {
      setIsLoading(false);
    }
  };

  const handleRespond = (tid: string) => {
    setRespondingTid(tid);
    setResponseText("");
  };

  const handleSendResponse = async (msg: any) => {
    if (!responseText.trim()) return;
    setIsLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem("auth_token");
      const res = await fetch(`${API_URL}/api/messages/respond`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          tid: msg.tid,
          recipient: msg.recipient,
          original: msg.message,
          response: responseText,
        }),
      });
      if (!res.ok) throw new Error("Failed to send response");
      setRespondingTid(null);
      setResponseText("");
    } catch (err) {
      setError("Failed to send response");
    } finally {
      setIsLoading(false);
    }
  };

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
      <Button mb="md" onClick={addExampleMessages} disabled={isLoading}>
        Add Example Messages
      </Button>
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

      {/* Message list */}
      <Stack gap="md">
        <Paper p="md" withBorder>
          <Text fw={500} size="md" mb="sm">
            Inbox
          </Text>
          {messages.length === 0 ? (
            <Text c="dimmed" size="sm" mb="md">
              You don't have any messages yet. Share your inbox link to start
              receiving questions.
            </Text>
          ) : (
            <Stack gap="sm">
              {messages.map((msg) => (
                <Paper key={msg.tid} p="sm" withBorder>
                  <Text size="sm">{msg.message}</Text>
                  <Text c="dimmed" size="xs">
                    {new Date(msg.createdAt).toLocaleString()}
                  </Text>
                  <Group gap="xs" mt="xs">
                    <Button
                      size="xs"
                      color="red"
                      variant="light"
                      onClick={() => handleDelete(msg.tid)}
                      disabled={isLoading}
                    >
                      Delete
                    </Button>
                    <Button
                      size="xs"
                      color="blue"
                      variant="light"
                      onClick={() => handleRespond(msg.tid)}
                      disabled={isLoading}
                    >
                      Respond
                    </Button>
                  </Group>
                  {respondingTid === msg.tid && (
                    <Stack gap="xs" mt="xs">
                      <textarea
                        value={responseText}
                        onChange={(e) => setResponseText(e.target.value)}
                        rows={3}
                        style={{ width: "100%" }}
                        placeholder="Type your response..."
                        disabled={isLoading}
                      />
                      <Button
                        size="xs"
                        color="green"
                        onClick={() => handleSendResponse(msg)}
                        disabled={isLoading || !responseText.trim()}
                      >
                        Send to Bluesky
                      </Button>
                      <Button
                        size="xs"
                        variant="subtle"
                        onClick={() => setRespondingTid(null)}
                        disabled={isLoading}
                      >
                        Cancel
                      </Button>
                    </Stack>
                  )}
                </Paper>
              ))}
            </Stack>
          )}
        </Paper>
      </Stack>
    </Container>
  );
}
