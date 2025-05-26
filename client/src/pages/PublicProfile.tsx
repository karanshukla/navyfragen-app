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

const API_URL = import.meta.env.VITE_API_URL || "";

export default function PublicProfile() {
  const { did } = useParams();
  const [profile, setProfile] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchProfile = async () => {
      setError(null);
      setProfile(null);
      try {
        const res = await fetch(
          `${API_URL}/api/public-profile/${encodeURIComponent(did)}`
        );
        if (!res.ok) throw new Error("Profile not found");
        const data = await res.json();
        setProfile(data.profile);
      } catch (err) {
        setError("Profile not found");
      }
    };
    if (did) fetchProfile();
  }, [did]);

  const handleSend = async () => {
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
