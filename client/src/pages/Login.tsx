import { useState } from "react";
import {
  Button,
  TextInput,
  Container,
  Title,
  Notification,
} from "@mantine/core";

export default function Login() {
  const [handle, setHandle] = useState("");
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const res = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
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
