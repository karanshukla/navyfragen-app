import { useEffect, useState } from "react";
import {
  Container,
  Title,
  Text,
  Paper,
  Stack,
  Alert,
  Button,
  Group,
  Textarea,
} from "@mantine/core";
import { useParams } from "react-router-dom";
import { z } from "zod";

const API_URL = import.meta.env.VITE_API_URL || "";

export default function PublicProfile() {
  const { did } = useParams();
  const [profile, setProfile] = useState<any>(null);
  const [userExists, setUserExists] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState<string | null>(null);

  // Zod schema for anonymous message (min 1, max 500 chars)
  const messageSchema = z
    .string()
    .min(1, "Message cannot be empty")
    .max(500, "Message too long (max 500 chars)");

  useEffect(() => {
    if (!did) return;
    setLoading(true);
    setError(null);
    // Check if user exists in app DB first
    fetch(`${API_URL}/api/user-exists/${encodeURIComponent(did)}`)
      .then((res) => res.json())
      .then((data) => {
        if (!data.exists) {
          setUserExists(false);
          setLoading(false);
        } else {
          setUserExists(true);
          // Fetch public profile only if user exists
          fetch(`${API_URL}/api/public-profile/${encodeURIComponent(did)}`)
            .then((res) => res.json())
            .then((data) => {
              setProfile(data.profile || null);
              setLoading(false);
            })
            .catch(() => {
              setError("Failed to load profile");
              setLoading(false);
            });
        }
      })
      .catch(() => {
        setError("Failed to check user existence");
        setLoading(false);
      });
  }, [did]);

  const handleSend = async () => {
    // Validate message before sending
    const result = messageSchema.safeParse(message);
    if (!result.success) {
      setError(result.error.errors[0].message);
      return;
    }
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch(`${API_URL}/api/messages/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipient: did, message }),
      });
      if (!res.ok) throw new Error("Failed to send message");
      setSuccess("Message sent anonymously!");
      setMessage("");
    } catch (err) {
      setError("Failed to send message");
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <Container>Loading...</Container>;
  if (userExists === false)
    return (
      <Container>
        <Alert color="red">This user has not signed up for NavyFragen.</Alert>
      </Container>
    );
  if (error)
    return (
      <Container>
        <Alert color="red">{error}</Alert>
      </Container>
    );

  return (
    <Container>
      {profile ? (
        <Paper p="md" withBorder mb="lg">
          <Title order={2} mb="xs">
            {profile.displayName || profile.handle || did}
          </Title>
          <Text c="dimmed" size="sm" mb="md">
            {profile.handle ? `@${profile.handle}` : did}
          </Text>
          {profile.description && <Text mb="md">{profile.description}</Text>}
        </Paper>
      ) : error ? (
        <Alert color="red">{error}</Alert>
      ) : (
        <Text>Loading profile...</Text>
      )}
      <Stack gap="md" mt="md">
        <Title order={3}>Send an anonymous message</Title>
        <Textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Type your message..."
          minRows={3}
          disabled={loading}
        />
        <Button onClick={handleSend} disabled={loading || !message.trim()}>
          Send
        </Button>
        {success && <Alert color="green">{success}</Alert>}
        {error && !profile && <Alert color="red">{error}</Alert>}
      </Stack>
    </Container>
  );
}
