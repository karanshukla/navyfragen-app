import { useState } from "react";
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
  Avatar,
  Loader,
  Center,
  useMantineColorScheme,
} from "@mantine/core";
import { useParams } from "react-router-dom";
import {
  useResolveHandle,
  useUserExists,
  usePublicProfile,
} from "../api/profileService";
import { useSendMessage } from "../api/messageService";

const MAX_MESSAGE_LENGTH = 280;

export default function PublicProfile() {
  const { handle } = useParams<{ handle: string }>();
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const {
    data: handleData,
    isLoading: handleLoading,
    error: handleError,
  } = useResolveHandle(handle || null);

  const did = handleData?.did || null;

  const {
    data: userExistsData,
    isLoading: userExistsLoading,
    error: userExistsError,
  } = useUserExists(did);

  const userExists = userExistsData?.exists;

  const {
    data: profileData,
    isLoading: profileLoading,
    error: profileError,
  } = usePublicProfile(userExists ? did : null);

  const profile = profileData?.profile || null;

  const {
    mutate: sendMessage,
    isPending: sendLoading,
    error: sendError,
  } = useSendMessage();

  const handleSend = () => {
    if (!message.trim()) {
      setError("Message cannot be empty.");
      return;
    }
    if (message.length > MAX_MESSAGE_LENGTH) {
      setError(
        `Message cannot be longer than ${MAX_MESSAGE_LENGTH} characters.`
      );
      return;
    }

    if (
      !window.confirm("Are you sure you want to send this anonymous message?")
    ) {
      return;
    }

    setError(null);
    setSuccess(null);

    sendMessage(
      { recipient: did!, message },
      {
        onSuccess: () => {
          setSuccess("Message sent! Let's go!");
          setMessage("");
        },
        onError: (err: any) => {
          setError(err.error || "Failed to send message. Please try again.");
        },
      }
    );
  };

  // Combined loading state
  const isLoading =
    handleLoading || userExistsLoading || profileLoading || sendLoading;

  // Display error if handle resolution fails
  if (handleError) {
    return (
      <Container>
        <Alert color="red" title="Error">
          {typeof handleError === "object" &&
          handleError !== null &&
          "error" in handleError
            ? (handleError as any).error
            : "Failed to resolve handle. The handle may not exist."}
        </Alert>
      </Container>
    );
  }

  // Loading state
  if (isLoading) {
    return (
      <Container>
        <Center style={{ minHeight: "200px" }}>
          <Loader />
        </Center>
      </Container>
    );
  }

  // If user doesn't exist in the app
  if (did && !userExists) {
    return (
      <Container>
        <Alert color="yellow" title="User not found">
          This user hasn't set up their Navyfragen inbox yet.
        </Alert>
      </Container>
    );
  }

  return (
    <Container>
      {profile ? (
        <>
          <Paper p="md" withBorder mb="lg">
            <Group>
              <Avatar
                src={profile.avatar}
                alt={profile.displayName || profile.handle || "User"}
                size="xl"
                radius="xl"
              />
              <div>
                <Title order={3}>{profile.displayName}</Title>
                <Text>@{profile.handle}</Text>
                {profile.description && (
                  <Text mt="xs">{profile.description}</Text>
                )}
              </div>
            </Group>
          </Paper>

          <Title order={4} mb="md">
            Send an anonymous message
          </Title>

          {error && (
            <Alert color="red" title="Error" mb="md">
              {error}
            </Alert>
          )}

          {success && (
            <Alert color="green" title="Success" mb="md">
              {success}
            </Alert>
          )}

          <Stack>
            <Text size="sm" ta="right" c="dimmed">
              {message.length}/{MAX_MESSAGE_LENGTH}
            </Text>
            <Textarea
              placeholder={`Type your anonymous message or question... (${MAX_MESSAGE_LENGTH} chars max, Enter to send)`}
              value={message}
              onChange={(e) => {
                if (e.target.value.length <= MAX_MESSAGE_LENGTH) {
                  setMessage(e.target.value);
                }
              }}
              minRows={1}
              maxRows={3}
              autosize
              disabled={sendLoading}
              onKeyDown={(e) => {
                if (
                  (e.key === "Enter" &&
                    !e.shiftKey &&
                    !e.altKey &&
                    !e.metaKey) ||
                  (e.key === "Enter" && e.ctrlKey)
                ) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              variant="default"
            />
            <Group justify="flex-end">
              <Button
                onClick={handleSend}
                loading={sendLoading}
                variant="filled"
                size="md"
              >
                Send Anonymous Message
              </Button>
            </Group>
          </Stack>
        </>
      ) : (
        <Alert color="red" title="Error">
          Failed to load profile information.
        </Alert>
      )}
    </Container>
  );
}
