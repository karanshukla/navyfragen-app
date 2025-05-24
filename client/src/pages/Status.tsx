import { useState } from "react";
import {
  Button,
  TextInput,
  Container,
  Title,
  Notification,
} from "@mantine/core";
import { useNavigate } from "react-router-dom";

export default function Status() {
  const [status, setStatus] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const navigate = useNavigate();

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    const res = await fetch("/api/status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    const data = await res.json();
    if (res.ok) {
      setSuccess(true);
      setStatus("");
      setTimeout(() => navigate("/"), 1000);
    } else {
      setError(data.error || "Unknown error");
    }
  };

  return (
    <Container>
      <Title>Set Status</Title>
      <form onSubmit={onSubmit}>
        <TextInput
          label="Status"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          required
        />
        <Button type="submit" mt="md">
          Set Status
        </Button>
      </form>
      {error && <Notification color="red">{error}</Notification>}
      {success && <Notification color="green">Status updated!</Notification>}
    </Container>
  );
}
