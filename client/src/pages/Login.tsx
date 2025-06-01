import { useState, useEffect } from "react";
import {
  Button,
  TextInput,
  Container,
  Title,
  Notification,
  Loader,
  Text,
  Group,
  Grid, // Added Grid
} from "@mantine/core";
import { useLocation } from "react-router-dom";
import { z } from "zod";
import { useLogin } from "../api/authService";

export default function Login() {
  const [handle, setHandle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const location = useLocation();
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
  const { mutate: login, isPending } = useLogin();

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
      <Grid>
        <Grid.Col span={{ base: 12, md: 6 }}>
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
          {error && (
            <Notification mt="md" color="red">
              {error}
            </Notification>
          )}
        </Grid.Col>
        <Grid.Col span={{ base: 12, md: 6 }}>
          <Group mt="md">
            <Text c="dimmed">
              You will be directed to Bluesky to authenticate. Please verify
              that you see "navyfragen.app" in the login page text and
              "bsky.social" in the login URL. The app does not have access to
              your Bluesky password and does not require an app specific
              password.
              <br />
              <br />
              Authenticating allows the app to retrieve your anonymous messages
              and post your responses to Bluesky directly.
            </Text>
          </Group>
        </Grid.Col>
      </Grid>
    </Container>
  );
}
