import { useEffect, useState, useRef } from "react";
import {
  Container,
  Title,
  Text,
  Paper,
  Stack,
  Loader,
  Center,
  Alert, // Kept for persistent session/messages errors AND NOW FOR PAGE NOTIFICATIONS
  Button,
  Group,
  TextInput,
  Textarea,
  CopyButton,
  Tooltip,
  Checkbox,
  Grid,
  Box,
} from "@mantine/core";
import { useSession } from "../api/authService";
import {
  useMessages,
  useDeleteMessage,
  useRespondToMessage,
  useAddExampleMessages,
  Message,
} from "../api/messageService";
import { IconClipboard, IconSend2, IconTrash } from "@tabler/icons-react";
// REMOVE: import { notifications } from "@mantine/notifications";
import { ConfirmationModal } from "../components/ConfirmationModal";

const shortlinkurl =
  import.meta.env.VITE_SHORTLINK_URL || "localhost:3033/profile";

interface PageAlert {
  title: string;
  message: React.ReactNode;
  color: "red" | "green" | "blue" | "yellow";
}

export default function Messages() {
  const [respondingTid, setRespondingTid] = useState<string | null>(null);
  const [responseText, setResponseText] = useState<string>("");
  const [deleteAfterResponding, setDeleteAfterResponding] =
    useState<boolean>(false);
  const [useGradients, setUseGradients] = useState<boolean>(true);
  const [autoRefresh, setAutoRefresh] = useState<boolean>(true);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [isPortrait, setIsPortrait] = useState(
    window.matchMedia("(orientation: portrait)").matches
  );
  const [confirmBeforeDelete, setConfirmBeforeDelete] =
    useState<boolean>(false);
  const [deleteModalOpened, setDeleteModalOpened] = useState<boolean>(false);
  const [messageIdToDelete, setMessageIdToDelete] = useState<string | null>(
    null
  );
  const [pageAlert, setPageAlert] = useState<PageAlert | null>(null); // ADDED for page-level alerts

  const {
    data: session,
    isLoading: sessionLoading,
    error: sessionError,
  } = useSession();

  const {
    data: messagesData,
    isLoading: messagesLoading,
    error: messagesError,
    refetch: refetchMessages,
  } = useMessages(session?.did || null, {
    refetchInterval: autoRefresh ? 3000 : false,
  });

  const { mutate: deleteMessage, isPending: deleteLoading } =
    useDeleteMessage();
  const { mutate: respondToMessage, isPending: respondLoading } =
    useRespondToMessage();
  const { mutate: addExamples, isPending: examplesLoading } =
    useAddExampleMessages();

  useEffect(() => {
    const isNewLogin = sessionStorage.getItem("newLogin");
    if (isNewLogin === "true") {
      setPageAlert({
        // MODIFIED
        title: "Welcome back!",
        message: "You have successfully logged in.",
        color: "green",
      });
      sessionStorage.removeItem("newLogin");
    }
  }, []);

  const handleAddExampleMessages = () => {
    if (!session?.did) return;
    setPageAlert(null); // Clear previous alert
    addExamples(session.did, {
      onSuccess: () => {
        refetchMessages();
        setPageAlert({
          // MODIFIED
          title: "Test Messages Added",
          message: "Example messages have been added to your inbox.",
          color: "blue",
        });
      },
      onError: (err: any) => {
        setPageAlert({
          // MODIFIED
          title: "Error Adding Examples",
          message: err.error || "Failed to add example messages.",
          color: "red",
        });
      },
    });
  };

  const handleDeleteRequest = (tid: string) => {
    if (confirmBeforeDelete) {
      setMessageIdToDelete(tid);
      setDeleteModalOpened(true);
    } else {
      performDelete(tid);
    }
  };

  const performDelete = (tid: string, fromModal: boolean = false) => {
    setPageAlert(null); // Clear previous alert
    deleteMessage(tid, {
      onSuccess: () => {
        if (respondingTid === tid) setRespondingTid(null);
        if (fromModal) {
          setDeleteModalOpened(false);
          setMessageIdToDelete(null);
        }
        refetchMessages();
      },
      onError: (err: any) => {
        setPageAlert({
          // MODIFIED
          title: "Error Deleting Message",
          message: err.error || "Failed to delete message.",
          color: "red",
        });
        if (fromModal) {
          setDeleteModalOpened(false);
          setMessageIdToDelete(null);
        }
      },
    });
  };

  const handleConfirmDelete = () => {
    if (messageIdToDelete) {
      performDelete(messageIdToDelete, true);
    }
    // Modal is closed within performDelete if called fromModal
  };

  const handlePrepareResponse = (tid: string) => {
    setRespondingTid(tid);
    setResponseText("");
  };

  const handleSendResponse = (msg: Message) => {
    setPageAlert(null); // Clear previous alert
    if (!responseText.trim()) {
      setPageAlert({
        // MODIFIED
        title: "Empty Response",
        message: "Response cannot be empty.",
        color: "yellow",
      });
      return;
    }

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
          setResponseText("");
          let successMessage: React.ReactNode =
            "Your response has been posted.";
          if (data.link) {
            successMessage = (
              <>
                Your response has been posted. View on Bluesky:{" "}
                <a
                  href={data.link}
                  target="_blank"
                  rel="noreferrer"
                  style={{ color: "inherit", textDecoration: "underline" }}
                >
                  {data.link}
                </a>
              </>
            );
          }
          setPageAlert({
            // MODIFIED
            title: "Response Sent!",
            message: successMessage,
            color: "green",
          });
          // Removed separate notification for Bluesky link, incorporated into one.

          if (deleteAfterResponding) {
            setTimeout(() => {
              performDelete(msg.tid);
            }, 1000);
          } else {
            refetchMessages();
          }
        },
        onError: (err: any) => {
          setPageAlert({
            // MODIFIED
            title: "Response Error",
            message: err.error || "Failed to send response.",
            color: "red",
          });
        },
      }
    );
  };

  useEffect(() => {
    if (respondingTid && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [respondingTid]);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(orientation: portrait)");
    const handleChange = () => setIsPortrait(mediaQuery.matches);
    handleChange();
    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  return (
    <Container>
      <Title>Messages</Title>
      {pageAlert && (
        <Alert
          title={pageAlert.title}
          color={pageAlert.color}
          withCloseButton
          onClose={() => setPageAlert(null)}
          mb="lg"
        >
          {pageAlert.message}
        </Alert>
      )}
      {sessionError && (
        <Alert
          color="red"
          title="Session Error"
          mb="lg"
          withCloseButton
          onClose={() => {}}
        >
          {typeof sessionError === "object" &&
          sessionError !== null &&
          "error" in sessionError
            ? (sessionError as any).error
            : "Failed to load session data"}
        </Alert>
      )}
      {messagesError && (
        <Alert
          color="red"
          title="Messages Error"
          mb="lg"
          withCloseButton
          onClose={() => {
            /* Allow dismissing */
          }}
        >
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
              and messages. Don't forget, your inbox link is publicly
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
              <Button
                onClick={handleAddExampleMessages}
                loading={examplesLoading}
              >
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
              <Text c="dimmed" size="xs" mb="md">
                You have {messagesData.messages.length} message(s)
              </Text>
              <Group mb="md">
                <Checkbox
                  checked={deleteAfterResponding}
                  onChange={(event) =>
                    setDeleteAfterResponding(event.currentTarget.checked)
                  }
                  label="Delete messages after responding"
                />
                <Checkbox
                  checked={useGradients}
                  onChange={(event) =>
                    setUseGradients(event.currentTarget.checked)
                  }
                  label="Use gradients"
                />
                <Checkbox
                  checked={autoRefresh}
                  onChange={(event) =>
                    setAutoRefresh(event.currentTarget.checked)
                  }
                  label="Auto-refresh messages"
                />
                <Checkbox
                  checked={confirmBeforeDelete}
                  onChange={(event) =>
                    setConfirmBeforeDelete(event.currentTarget.checked)
                  }
                  label="Confirm before deleting messages"
                />
              </Group>
              <Grid align="flex-start">
                {" "}
                {(messagesData.messages ?? []).map((msg: Message) => (
                  <Grid.Col
                    span={isPortrait ? 12 : { base: 12, sm: 6, md: 6, lg: 6 }}
                    key={msg.tid}
                  >
                    <Paper
                      p="md"
                      shadow="lg"
                      onClick={() => {
                        if (respondingTid !== msg.tid) {
                          handlePrepareResponse(msg.tid);
                        } else {
                          setRespondingTid(null);
                        }
                      }}
                      style={{
                        cursor: "pointer",
                        height: "100%",
                        background: useGradients
                          ? "linear-gradient(to right, #005299, #7700aa)"
                          : undefined,
                      }}
                    >
                      <Stack>
                        <Group justify="space-between">
                          <Text size="sm" c="white">
                            {new Date(msg.createdAt).toLocaleString(undefined, {
                              year: "numeric",
                              month: "2-digit",
                              day: "2-digit",
                              hour: "2-digit",
                              minute: "2-digit",
                              hour12: true,
                              timeZoneName: "short",
                            })}
                          </Text>
                          <Group>
                            <Button
                              size="xs"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteRequest(msg.tid);
                              }}
                              color="red"
                              variant="outline"
                              loading={
                                deleteLoading &&
                                messageIdToDelete === msg.tid &&
                                !confirmBeforeDelete
                              }
                            >
                              <IconTrash size={16} />
                            </Button>
                          </Group>
                        </Group>
                        <Center>
                          <Text
                            c="white"
                            fw="bold"
                            style={{
                              wordBreak: "break-word",
                              whiteSpace: "pre-wrap",
                            }}
                          >
                            {msg.message}
                          </Text>
                        </Center>
                        {respondingTid === msg.tid && (
                          <Stack>
                            <Textarea
                              styles={{
                                input: {
                                  backgroundColor: "white",
                                  border: "none",
                                  color: "black",
                                },
                              }}
                              ref={textareaRef}
                              value={responseText}
                              maxLength={280}
                              description={`${responseText.length}/280 characters`}
                              error={
                                responseText.length > 280
                                  ? "Message exceeds Bluesky's character limit"
                                  : null
                              }
                              onChange={(e) => setResponseText(e.target.value)}
                              onClick={(e) => e.stopPropagation()}
                              autosize
                              minRows={1}
                              maxRows={2}
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
                                  e.stopPropagation();
                                  handleSendResponse(msg);
                                }}
                                loading={respondLoading}
                                variant="outline"
                              >
                                <IconSend2 />
                              </Button>
                            </Group>
                          </Stack>
                        )}
                      </Stack>
                    </Paper>
                  </Grid.Col>
                ))}
              </Grid>
            </>
          ) : (
            <Alert color="blue" title="No messages">
              You don't have any messages yet. Share your profile link to
              receive anonymous messages.
            </Alert>
          )}
        </>
      )}
      <ConfirmationModal
        opened={deleteModalOpened}
        onClose={() => {
          if (!deleteLoading) {
            // Prevent closing if delete is in progress via modal
            setDeleteModalOpened(false);
            setMessageIdToDelete(null);
          }
        }}
        onConfirm={handleConfirmDelete}
        title="Confirm Deletion"
        message="Are you sure you want to delete this message? This action cannot be undone."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        loading={deleteLoading && !!messageIdToDelete} // Show loading in modal during confirm delete
      />
    </Container>
  );
}
