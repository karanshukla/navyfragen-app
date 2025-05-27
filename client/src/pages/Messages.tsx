import { useEffect, useState } from "react";
import {
  Container,
  Title,
  Text,
  Paper,
  Stack,
  Loader,
  Center,
  Alert,
  Button,
  Group,
  TextInput,
  Textarea,
  CopyButton,
  Tooltip,
} from "@mantine/core";
import { useSession } from "../api/authService";
import {
  useMessages,
  useDeleteMessage,
  useRespondToMessage,
  useAddExampleMessages,
  Message,
} from "../api/messageService";

export default function Messages() {
  const [welcomeMessage, setWelcomeMessage] = useState<boolean>(false);
  const [respondingTid, setRespondingTid] = useState<string | null>(null);
  const [responseText, setResponseText] = useState<string>("");
  const [lastPostLink, setLastPostLink] = useState<{
    tid: string;
    link: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Get session data
  const {
    data: session,
    isLoading: sessionLoading,
    error: sessionError,
  } = useSession();

  // Get messages data using the session's DID
  const {
    data: messagesData,
    isLoading: messagesLoading,
    error: messagesError,
    refetch: refetchMessages,
  } = useMessages(session?.did || null, {
    refetchInterval: 3000, // Poll every 3 seconds for real-time updates
  });

  // Get mutation functions
  const { mutate: deleteMessage, isPending: deleteLoading } =
    useDeleteMessage();
  const { mutate: respondToMessage, isPending: respondLoading } =
    useRespondToMessage();
  const { mutate: addExamples, isPending: examplesLoading } =
    useAddExampleMessages();

  // Show a welcome message for newly logged-in users
  useEffect(() => {
    const isNewLogin = sessionStorage.getItem("newLogin");
    if (isNewLogin === "true") {
      setWelcomeMessage(true);
      sessionStorage.removeItem("newLogin");
    }
  }, []);

  // The combined loading state
  const isLoading =
    sessionLoading ||
    messagesLoading ||
    deleteLoading ||
    respondLoading ||
    examplesLoading;

  // Add example messages for testing
  const handleAddExampleMessages = () => {
    if (!session?.did) return;
    setError(null);
    addExamples(session.did, {
      onSuccess: () => {
        refetchMessages();
      },
      onError: (err: any) => {
        setError(err.error || "Failed to add example messages");
      },
    });
  };

  // Handle message deletion
  const handleDelete = (tid: string) => {
    setError(null);
    deleteMessage(tid, {
      onError: (err: any) => {
        setError(err.error || "Failed to delete message");
      },
    });
  };

  // Handle response preparation
  const handleRespond = (tid: string) => {
    setRespondingTid(tid);
    setResponseText("");
  };

  // Handle sending a response
  const handleSendResponse = (msg: Message) => {
    if (!responseText.trim()) return;
    setError(null);

    respondToMessage(
      {
        tid: msg.tid,
        recipient: msg.recipient,
        original: msg.message,
        response: responseText,
      },
      {
        onSuccess: (data) => {
          setRespondingTid(null);
          if (data.link) {
            setLastPostLink({ tid: msg.tid, link: data.link });
          }
          refetchMessages();
        },
        onError: (err: any) => {
          setError(err.error || "Failed to send response");
        },
      }
    );
  };

  return (
    <Container>
      <Title>Messages</Title>

      {welcomeMessage && (
        <Alert color="green" title="Welcome back!" mb="lg">
          You have successfully logged in.
        </Alert>
      )}

      {error && (
        <Alert color="red" title="Error" mb="lg">
          {error}
        </Alert>
      )}

      {sessionError && (
        <Alert color="red" title="Session Error" mb="lg">
          {typeof sessionError === "object" &&
          sessionError !== null &&
          "error" in sessionError
            ? (sessionError as any).error
            : "Failed to load session data"}
        </Alert>
      )}

      {messagesError && (
        <Alert color="red" title="Messages Error" mb="lg">
          {typeof messagesError === "object" &&
          messagesError !== null &&
          "error" in messagesError
            ? (messagesError as any).error
            : "Failed to load messages"}
        </Alert>
      )}

      {sessionLoading ? (
        <Center>
          <Loader size="xl" />
        </Center>
      ) : !session?.isLoggedIn ? (
        <Alert color="red" title="Not logged in">
          Please log in to see your messages.
        </Alert>
      ) : (
        <>
          <Paper p="md" withBorder mb="lg">
            <Text mb="md">
              This is your anonymous inbox. Share the link below to let others
              send you anonymous questions and messages.
            </Text>
            <Group>
              <TextInput
                readOnly
                value={`${window.location.origin}/profile/${
                  session.profile?.handle || ""
                }`}
                style={{ flexGrow: 1 }}
              />
              <CopyButton
                value={`${window.location.origin}/profile/${
                  session.profile?.handle || ""
                }`}
              >
                {({ copied, copy }) => (
                  <Tooltip
                    label={copied ? "Copied" : "Copy"}
                    withArrow
                    position="right"
                  >
                    <Button onClick={copy}>
                      {copied ? "Copied" : "Copy Inbox Link"}
                    </Button>
                  </Tooltip>
                )}
              </CopyButton>
              <Button onClick={handleAddExampleMessages}>
                Add Test Messages
              </Button>
            </Group>
          </Paper>

          {messagesLoading ? (
            <Center>
              <Loader size="lg" />
            </Center>
          ) : messagesData && messagesData.messages && messagesData.messages.length > 0 ? (
            <Stack gap="md">
              <Text c="dimmed" size="sm" mb="md">
                You have {messagesData.messages.length} messages.
              </Text>
              {(messagesData.messages ?? []).map((msg: Message) => (
                <Paper key={msg.tid} p="md" withBorder>
                  <Stack>
                    <Group justify="space-between">
                      <Text size="sm" c="dimmed">
                        {new Date(msg.createdAt).toLocaleString()}
                      </Text>
                      <Group>
                        <Button
                          size="xs"
                          onClick={() => handleDelete(msg.tid)}
                          color="red"
                          variant="outline"
                        >
                          Delete
                        </Button>
                        <Button
                          size="xs"
                          onClick={() => handleRespond(msg.tid)}
                          color="blue"
                          variant="filled"
                        >
                          Respond
                        </Button>
                      </Group>
                    </Group>
                    <Text>{msg.message}</Text>

                    {respondingTid === msg.tid && (
                      <Stack>
                        <Textarea
                          placeholder="Write your response..."
                          value={responseText}
                          onChange={(e) => setResponseText(e.target.value)}
                          autosize
                          minRows={3}
                          maxRows={10}
                        />
                        <Group justify="flex-end">
                          <Button
                            size="sm"
                            onClick={() => setRespondingTid(null)}
                            variant="outline"
                          >
                            Cancel
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => handleSendResponse(msg)}
                            loading={respondLoading}
                          >
                            Post Response
                          </Button>
                        </Group>
                      </Stack>
                    )}

                    {lastPostLink && lastPostLink.tid === msg.tid && (
                      <Alert color="green" title="Response posted">
                        <Group>
                          <Text>View your response on Bluesky:</Text>
                          <a
                            href={lastPostLink.link}
                            target="_blank"
                            rel="noreferrer"
                          >
                            {lastPostLink.link}
                          </a>
                        </Group>
                      </Alert>
                    )}
                  </Stack>
                </Paper>
              ))}
            </Stack>
          ) : (
            <Alert color="blue" title="No messages">
              You don't have any messages yet. Share your profile link to
              receive anonymous messages.
            </Alert>
          )}
        </>
      )}
    </Container>
  );
}
