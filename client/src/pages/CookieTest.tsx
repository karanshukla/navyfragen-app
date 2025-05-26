import { useEffect, useState } from "react";
import {
  Container,
  Title,
  Button,
  Alert,
  Text,
  Stack,
  Paper,
} from "@mantine/core";

// Use the API URL from environment variable
const API_URL = import.meta.env.VITE_API_URL || "";

export default function CookieTest() {
  const [token, setToken] = useState<string | null>(null);
  const [response, setResponse] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);

  const testAuth = async () => {
    setLoading(true);
    try {
      const authToken = localStorage.getItem("auth_token");
      let url = `${API_URL}/api/debug-cookies`;
      if (authToken) {
        url += `?token=${authToken}`;
      }

      const res = await fetch(url, {
        method: "GET",
      });

      const data = await res.json();
      setResponse(data);
    } catch (error) {
      console.error("Auth test error:", error);
      setResponse({ error: "Failed to test authentication" });
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    // Display token from localStorage
    const authToken = localStorage.getItem("auth_token");
    setToken(authToken);
  }, []);

  return (
    <Container>
      <Title mb="xl">Authentication Test Page</Title>
      <Paper p="md" withBorder mb="lg">
        <Title order={3} mb="xs">
          Authentication Token
        </Title>
        <Text>
          {token ? `Token: ${token}` : "No authentication token found"}
        </Text>
      </Paper>
      <Button onClick={testAuth} loading={loading} mb="lg">
        Test Server Authentication
      </Button>
      {response && (
        <Stack>
          <Title order={3}>Server Response</Title>
          <Paper p="md" withBorder>
            <pre>{JSON.stringify(response, null, 2)}</pre>
          </Paper>
        </Stack>
      )}{" "}
      <Alert mt="xl" title="How to debug">
        <Text>
          This page helps debug token-based authentication by checking:
          <ol>
            <li>What token is stored in localStorage (client-side)</li>
            <li>Whether the server recognizes the token</li>
            <li>What data is returned from the server based on the token</li>
          </ol>
          After logging in, return to this page to see your authentication
          status.
        </Text>
      </Alert>
    </Container>
  );
}
