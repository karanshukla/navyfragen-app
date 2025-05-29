import { useEffect, useState, useRef } from "react"; // Added useRef
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
  Checkbox,
} from "@mantine/core";
import { useSession } from "../api/authService";
import {
  useMessages,
  useDeleteMessage,
  useRespondToMessage,
  useAddExampleMessages,
  Message,
} from "../api/messageService";
import { IconClipboard, IconMail, IconTrash } from "@tabler/icons-react";

const shortlinkurl =
  import.meta.env.VITE_SHORTLINK_URL || "localhost:3033/profile";

export default function Messages() {
  const [welcomeMessage, setWelcomeMessage] = useState<boolean>(false);
  const [respondingTid, setRespondingTid] = useState<string | null>(null);
  const [responseText, setResponseText] = useState<string>("");
  const [lastPostLink, setLastPostLink] = useState<{
    tid: string;
    link: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deleteAfterResponding, setDeleteAfterResponding] =
    useState<boolean>(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null); // Ref for the textarea

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
          if (deleteAfterResponding) {
            setTimeout(() => {
              deleteMessage(msg.tid, {
                onSuccess: () => {
                  refetchMessages(); // Refetch after successful deletion
                },
                onError: (err: any) => {
                  setError(
                    err.error || "Failed to delete message after responding."
                  );
                  refetchMessages(); // Refetch even if deletion fails to sync UI
                },
              });
            }, 5000); // Delay deletion by 5 seconds
          } else {
            refetchMessages(); // Refetch if not deleting
          }
        },
        onError: (err: any) => {
          setError(err.error || "Failed to send response");
        },
      }
    );
  };

  // Effect to focus textarea when it becomes active
  useEffect(() => {
    if (respondingTid && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [respondingTid]);

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
          <Paper withBorder p="md" mb="lg" shadow="sm">
            <Text mb="md">
              Share the link below to let others send you anonymous questions
              and messages. Don't forget, your inbox link is publically
              accessible!
            </Text>
            <Group>
              <TextInput
                readOnly
                value={`${shortlinkurl}/${session.profile?.handle || ""}`}
                style={{ flexGrow: 1 }}
              />
              <CopyButton
                value={`${shortlinkurl}/${session.profile?.handle || ""}`}
              >
                {({ copied, copy }) => (
                  <Tooltip
                    label={copied ? "Copied" : "Copy"}
                    withArrow
                    position="right"
                  >
                    <Button onClick={copy}>
                      <IconClipboard />
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
          ) : messagesData &&
            messagesData.messages &&
            messagesData.messages.length > 0 ? (
            <>
              <Stack gap="md">
                <Text c="dimmed" size="xs" mb="md">
                  You have {messagesData.messages.length} messages.
                </Text>
                <Checkbox
                  checked={deleteAfterResponding}
                  onChange={(event) =>
                    setDeleteAfterResponding(event.currentTarget.checked)
                  }
                  label="Delete messages after responding"
                />
                {(messagesData.messages ?? []).map((msg: Message) => (
                  <Paper
                    key={msg.tid}
                    p="md"
                    shadow="lg"
                    onClick={() => {
                      if (respondingTid !== msg.tid) {
                        handleRespond(msg.tid);
                      } else {
                        setRespondingTid(null); // Close if already open
                      }
                    }}
                    style={{
                      cursor: "pointer", // Always show pointer as it's always interactive
                    }}
                  >
                    <Stack>
                      <Group justify="space-between">
                        <Text size="sm" c="dimmed">
                          {new Date(msg.createdAt).toLocaleString()}
                        </Text>
                        <Group>
                          <Button
                            size="xs"
                            onClick={(e) => {
                              e.stopPropagation(); // Prevent Paper's onClick
                              handleDelete(msg.tid);
                            }}
                            color="red"
                            variant="outline"
                          >
                            <IconTrash size={16} />
                          </Button>
                        </Group>
                      </Group>
                      <Text
                        style={{
                          wordBreak: "break-word",
                          whiteSpace: "pre-wrap",
                        }}
                      >
                        {msg.message}
                      </Text>
                      {respondingTid === msg.tid && (
                        <Stack>
                          <Textarea
                            ref={textareaRef}
                            placeholder="Write your response..."
                            value={responseText}
                            maxLength={280}
                            description={`${responseText.length}/280 characters`}
                            error={
                              responseText.length > 280
                                ? "Message exceeds Bluesky's character limit"
                                : null
                            }
                            onChange={(e) => setResponseText(e.target.value)}
                            onClick={(e) => e.stopPropagation()} // Prevent Paper's onClick
                            autosize
                            minRows={1}
                            maxRows={1}
                            onKeyDown={(event) => {
                              if (event.key === "Enter" && !event.shiftKey) {
                                event.preventDefault();
                                handleSendResponse(msg);
                              }
                            }}
                          />
                          <Group justify="flex-end">
                            <Button
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation(); // Prevent Paper's onClick
                                handleSendResponse(msg);
                              }}
                              loading={respondLoading}
                            >
                              Post Response
                            </Button>
                          </Group>
                        </Stack>
                      )}

                      {lastPostLink && lastPostLink.tid === msg.tid && (
                        <Alert color="green" title="Response posted">
                          <Group gap="xs">
                            <Text>View your response on Bluesky:</Text>
                            <a
                              href={lastPostLink.link}
                              target="_blank"
                              rel="noreferrer"
                            >
                              <Button variant="outline" size="xs">
                                {lastPostLink.link}
                              </Button>
                            </a>
                          </Group>
                        </Alert>
                      )}
                    </Stack>
                  </Paper>
                ))}
              </Stack>
            </>
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
