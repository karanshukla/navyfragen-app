import { useState, useEffect } from "react";
import {
  Button,
  TextInput,
  Container,
  Title,
  Notification,
} from "@mantine/core";
import { useLocation } from "react-router-dom";

// Use the VITE_API_URL env variable for backend API calls
const API_URL = import.meta.env.VITE_API_URL || "";

export default function Login() {
  const [handle, setHandle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const location = useLocation();

  // Handle OAuth callback
  useEffect(() => {
    if (
      location.pathname === "/oauth/callback" ||
      location.pathname === "/api/oauth/callback"
    ) {
      fetch(`${API_URL}/api/oauth/callback${location.search}`, {
        credentials: "include",
      })
        .then(async (res) => {
          // If the response is a redirect (from Bluesky), force redirect
          if (res.redirected && res.url) {
            window.location.href = "/";
            return;
          }
          const data = await res.json();
          if (data.message) {
            setSuccess(data.message);
            setTimeout(() => {
              window.location.href = "/";
            }, 1000); // Redirect to home after 1s
          } else setError(data.error || "OAuth callback failed");
        })
        .catch(() => setError("OAuth callback failed"));
    }
  }, [location]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const res = await fetch(`${API_URL}/api/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ handle }),
    });
    const data = await res.json();
    if (data.redirectUrl) {
      window.location.href = data.redirectUrl;
    } else {
      setError(data.error || "Unknown error");
    }
  };

  return (
    <Container>
      <Title>Login</Title>
      {success && <Notification color="green">{success}</Notification>}
      <form onSubmit={onSubmit}>
        <TextInput
          label="Bluesky Handle"
          value={handle}
          onChange={(e) => setHandle(e.target.value)}
          required
        />
        <Button type="submit" mt="md">
          Log in
        </Button>
      </form>
      {error && <Notification color="red">{error}</Notification>}
    </Container>
  );
}
