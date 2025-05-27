import { useState, useEffect } from "react";
import {
  Button,
  TextInput,
  Container,
  Title,
  Notification,
  Loader,
} from "@mantine/core";
import { useLocation } from "react-router-dom";
import { z } from "zod";
import { useLogin } from "../api/authService";
import { apiClient } from "../api/apiClient";

export default function Login() {
  const [handle, setHandle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const location = useLocation();
  // Check for error or token query param (e.g. from OAuth callback redirect)
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const errorParam = searchParams.get("error");
    if (errorParam === "oauth_failed") {
      setError("Login failed. Please try again.");
      setSuccess(null);
    }
    // Check for token param (local dev workaround)
    const token = searchParams.get("token");
    if (token) {
      apiClient
        .setCookie(token)
        .then(() => {
          setSuccess("Session established! You are now logged in.");
          // Remove token from URL
          window.history.replaceState({}, document.title, location.pathname);
          // Optionally reload or redirect
          window.location.reload();
        })
        .catch((err) => {
          setError(err.error || "Failed to set session cookie.");
        });
    }
  }, [location]);
  const handleSchema = z
    .string()
    .min(1, "Handle is required")
    .max(64, "Handle too long");
  const { mutate: login, isPending, error: loginError } = useLogin();

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const result = handleSchema.safeParse(handle);
    if (!result.success) {
      setError(result.error.errors[0].message);
      return;
    }

    login(
      { handle },
      {
        onSuccess: (data) => {
          if (data.redirectUrl) {
            sessionStorage.setItem("newLogin", "true");
            window.location.href = data.redirectUrl;
          }
        },
        onError: (err: any) => {
          setError(err.error || "Login failed. Please try again.");
        },
      }
    );
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
        />{" "}
        <Button type="submit" mt="md" loading={isPending}>
          Log in
        </Button>
      </form>
      {error && <Notification color="red">{error}</Notification>}
    </Container>
  );
}
