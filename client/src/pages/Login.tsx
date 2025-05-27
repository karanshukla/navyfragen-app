import { useState, useEffect } from "react";
import {
  Button,
  TextInput,
  Container,
  Title,
  Notification,
} from "@mantine/core";
import { useLocation } from "react-router-dom";
import { z } from "zod";

// Use the VITE_API_URL env variable for backend API calls
const API_URL = import.meta.env.VITE_API_URL || "";

export default function Login() {
  const [handle, setHandle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const location = useLocation();
  // Check for error query param (e.g. from OAuth callback redirect)
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const errorParam = searchParams.get("error");
    if (errorParam === "oauth_failed") {
      setError("Login failed. Please try again.");
      setSuccess(null);
    }
  }, [location]);
  const handleSchema = z
    .string()
    .min(1, "Handle is required")
    .max(64, "Handle too long");

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const result = handleSchema.safeParse(handle);
    if (!result.success) {
      setError(result.error.errors[0].message);
      return;
    }
    const res = await fetch(`${API_URL}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ handle }),
    });
    const data = await res.json();
    if (data.redirectUrl) {
      sessionStorage.setItem("newLogin", "true");
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
          label="Bluesky Handle (without @)"
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
