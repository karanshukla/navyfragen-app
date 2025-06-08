import { useEffect, useState, useRef } from "react";
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
  Grid,
  Divider,
  Box,
  Switch,
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
import { ConfirmationModal } from "../components/ConfirmationModal";
import ShareButton from "../components/ShareButton";
import { useLocalStorage } from "@mantine/hooks";

const shortlinkurl =
  import.meta.env.VITE_SHORTLINK_URL || "localhost:5173/profile";

const MAX_BSKY_POST_LENGTH = 280;
const GENERAL_BUFFER = 3; // In case formatting changes in the BE or other stuff

interface PageAlert {
  title: string;
  message: React.ReactNode;
  color: "red" | "green" | "blue" | "yellow";
}

export default function Messages() {
  const [respondingTid, setRespondingTid] = useState<string | null>(null);
  const [responseText, setResponseText] = useState<string>("");
  const [focusedCardIndex, setFocusedCardIndex] = useState<number>(-1);
  const messageCardRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Local storage settings
  const [appendProfileLink, setAppendProfileLink] = useLocalStorage({
    key: "appendProfileLink",
    defaultValue: false,
    getInitialValueInEffect: true,
  });
  const [useGradients, setUseGradients] = useLocalStorage({
    key: "useGradients",
    defaultValue: true,
    getInitialValueInEffect: true,
  });
  const [includeQuestionAsImage, setIncludeQuestionAsImage] = useLocalStorage({
    key: "includeQuestionAsImage",
    defaultValue: true,
    getInitialValueInEffect: true,
  });
  const [confirmBeforeDelete, setConfirmBeforeDelete] = useLocalStorage({
    key: "confirmBeforeDelete",
    defaultValue: false,
    getInitialValueInEffect: true,
  });

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [isPortrait, setIsPortrait] = useState(
    window.matchMedia("(orientation: portrait)").matches
  );
  const [deleteModalOpened, setDeleteModalOpened] = useState<boolean>(false);
  const [messageIdToDelete, setMessageIdToDelete] = useState<string | null>(
    null
  );
  const [pageAlert, setPageAlert] = useState<PageAlert | null>(null);
  const [characterLimit, setCharacterLimit] = useState<number>(280);
  const [deletingTid, setDeletingTid] = useState<string | null>(null);

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
    refetchInterval: 10000, //10 seconds
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });

  const { mutate: deleteMessage, isPending: deleteLoading } =
    useDeleteMessage();
  const { mutate: respondToMessage, isPending: respondLoading } =
    useRespondToMessage();
  const { mutate: addExamples, isPending: examplesLoading } =
    useAddExampleMessages();

  useEffect(() => {
    let maxLengthForResponse = MAX_BSKY_POST_LENGTH - GENERAL_BUFFER;

    if (appendProfileLink && session?.profile?.handle) {
      const profileLinkFull = ` ${shortlinkurl}/${session.profile.handle}`;
      maxLengthForResponse -= profileLinkFull.length;
    }

    if (!includeQuestionAsImage) {
      if (respondingTid && messagesData?.messages) {
        const currentMessage = messagesData.messages.find(
          (m) => m.tid === respondingTid
        );
        if (currentMessage) {
          const originalMessageText = currentMessage.message;
          // This should align with the backend formatting for accuracy
          const formattingPrefix = " \\n\\nAnon asked via 💙📩❓: *";
          const formattingSuffix = "*";
          const questionPartOverhead =
            formattingPrefix.length +
            originalMessageText.length +
            formattingSuffix.length;
          maxLengthForResponse -= questionPartOverhead;
        }
      }
    }

    setCharacterLimit(Math.max(0, maxLengthForResponse));
  }, [
    appendProfileLink,
    session?.profile?.handle,
    shortlinkurl,
    includeQuestionAsImage,
    respondingTid,
    messagesData,
  ]);

  useEffect(() => {
    const isNewLogin = sessionStorage.getItem("newLogin");
    if (isNewLogin === "true") {
      setPageAlert({
        title: "Welcome back!",
        message: "You have successfully logged in.",
        color: "green",
      });
      sessionStorage.removeItem("newLogin");
    }
  }, []);

  const handleAddExampleMessages = () => {
    if (!session?.did) return;
    setPageAlert(null);
    addExamples(session.did, {
      onSuccess: () => {
        refetchMessages();
      },
      onError: (err: any) => {
        setPageAlert({
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
    setPageAlert(null);
    setDeletingTid(tid);
    deleteMessage(tid, {
      onSuccess: () => {
        if (respondingTid === tid) setRespondingTid(null);
        if (fromModal) {
          setDeleteModalOpened(false);
          setMessageIdToDelete(null);
        }
        setDeletingTid(null);
        refetchMessages();
      },
      onError: (err: any) => {
        setPageAlert({
          title: "Error Deleting Message",
          message: err.error || "Failed to delete message.",
          color: "red",
        });
        if (fromModal) {
          setDeleteModalOpened(false);
          setMessageIdToDelete(null);
        }
        setDeletingTid(null);
      },
    });
  };

  const handleConfirmDelete = () => {
    if (messageIdToDelete) {
      performDelete(messageIdToDelete, true);
    }
  };

  const handlePrepareResponse = (tid: string) => {
    setRespondingTid(tid);
    setResponseText("");
    // Ensure the card that is being responded to gets focus for a11y
    const messageIndex = messagesData?.messages.findIndex(
      (msg) => msg.tid === tid
    );
    if (messageIndex !== undefined && messageIndex !== -1) {
      setFocusedCardIndex(messageIndex);
    }
  };

  const handleSendResponse = (msg: Message) => {
    setPageAlert(null);
    if (!responseText.trim()) {
      setPageAlert({
        title: "Empty Response",
        message: "Response cannot be empty.",
        color: "yellow",
      });
      return;
    }
    let appendedResponseText;
    if (appendProfileLink && session?.profile?.handle) {
      appendedResponseText =
        responseText + ` ${shortlinkurl}/${session.profile.handle}`;
    }

    respondToMessage(
      {
        tid: msg.tid,
        recipient: msg.recipient,
        original: msg.message,
        response: appendedResponseText ?? responseText,
        includeQuestionAsImage: includeQuestionAsImage,
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
            title: "Response Sent!",
            message: successMessage,
            color: "green",
          });
          refetchMessages();
        },
        onError: (err: any) => {
          setPageAlert({
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
      const messageCardId = `message-card-${respondingTid}`;
      const messageCardElement = document.getElementById(messageCardId);
      if (messageCardElement) {
        setTimeout(() => {
          messageCardElement.scrollIntoView({
            behavior: "smooth",
            block: "nearest",
          });
        }, 150);
      }
    }
  }, [respondingTid]);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(orientation: portrait)");
    const handleChange = () => setIsPortrait(mediaQuery.matches);
    handleChange();
    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  useEffect(() => {
    // Initialize or update messageCardRefs when messagesData changes
    if (messagesData?.messages) {
      messageCardRefs.current = messagesData.messages.map(() => null);
    }
  }, [messagesData]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const targetNodeName = (event.target as HTMLElement)?.nodeName;
      if (["INPUT", "TEXTAREA", "SELECT"].includes(targetNodeName)) {
        return;
      }

      if (event.altKey || event.metaKey) {
        if (event.key.toUpperCase() === "R") {
          event.preventDefault();
          if (messagesData?.messages && messagesData.messages.length > 0) {
            const newIndex =
              focusedCardIndex === -1
                ? 0
                : (focusedCardIndex + 1) % messagesData.messages.length;
            setFocusedCardIndex(newIndex);
            messageCardRefs.current[newIndex]?.focus();
          }
        }
      }

      // Navigate between cards with arrow keys when a card is focused
      if (
        focusedCardIndex !== -1 &&
        (event.key === "ArrowDown" || event.key === "ArrowUp")
      ) {
        event.preventDefault();
        if (messagesData?.messages && messagesData.messages.length > 0) {
          let newIndex = focusedCardIndex;
          if (event.key === "ArrowDown") {
            newIndex = (focusedCardIndex + 1) % messagesData.messages.length;
          }
          if (event.key === "ArrowUp") {
            newIndex =
              (focusedCardIndex - 1 + messagesData.messages.length) %
              messagesData.messages.length;
          }
          setFocusedCardIndex(newIndex);
          messageCardRefs.current[newIndex]?.focus();
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [focusedCardIndex, messagesData, setFocusedCardIndex]);

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
          onClose={() => {}}
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
              {(() => {
                const handle = session.profile?.handle || "";
                const fullUrl = `https://${shortlinkurl}/${handle}`;
                const sharePayload = {
                  title: "Send me anonymous messages on Navyfragen!",
                  text: `Send ${session.profile?.displayName} anonymous messages!`,
                  url: fullUrl,
                };
                return <ShareButton shareData={sharePayload} />;
              })()}
              <Button
                onClick={handleAddExampleMessages}
                loading={examplesLoading}
              >
                Add Examples
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
              <Group mb="md">
                <Switch
                  checked={appendProfileLink}
                  onChange={(event) =>
                    setAppendProfileLink(event.currentTarget.checked)
                  }
                  label="Append my link automatically"
                />
                <Switch
                  checked={useGradients}
                  onChange={(event) =>
                    setUseGradients(event.currentTarget.checked)
                  }
                  label="Use gradient backgrounds"
                />
                <Switch
                  checked={includeQuestionAsImage}
                  onChange={(event) =>
                    setIncludeQuestionAsImage(event.currentTarget.checked)
                  }
                  label="Include question as an image"
                />
                <Switch
                  checked={confirmBeforeDelete}
                  onChange={(event) =>
                    setConfirmBeforeDelete(event.currentTarget.checked)
                  }
                  label="Confirm before deleting"
                />
              </Group>
              <Divider mb="md" />
              <Grid align="flex-start">
                {(messagesData.messages ?? []).map(
                  (msg: Message, index: number) => (
                    <Grid.Col
                      span={isPortrait ? 12 : { base: 12, sm: 6, md: 6, lg: 6 }}
                      key={msg.tid}
                    >
                      <Paper
                        id={`message-card-${msg.tid}`}
                        ref={(el) => {
                          messageCardRefs.current[index] = el;
                        }}
                        tabIndex={0}
                        p="md"
                        shadow="lg"
                        onClick={() => {
                          if (respondingTid !== msg.tid) {
                            handlePrepareResponse(msg.tid);
                          } else {
                            setRespondingTid(null);
                          }
                        }}
                        onFocus={() => setFocusedCardIndex(index)} // Keep track of focused card
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            if (respondingTid !== msg.tid) {
                              handlePrepareResponse(msg.tid);
                            } else {
                              setRespondingTid(null);
                            }
                          }
                        }}
                        style={{
                          cursor: "pointer",
                          height: "100%",
                          background: useGradients
                            ? "linear-gradient(to right, #005299, #7700aa)"
                            : "var(--mantine-color-deepBlue-9)",
                          outline:
                            focusedCardIndex === index
                              ? "2px solid var(--mantine-color-blue-5)"
                              : "none",
                        }}
                      >
                        <Stack>
                          <Group justify="space-between">
                            <Box
                              p="xs"
                              style={{
                                borderRadius: "var(--mantine-radius-sm)",
                              }}
                            >
                              <Text size="xs" c="white">
                                {" "}
                                {/* Changed c="white" and removed variant="subtle" */}
                                {new Date(msg.createdAt).toLocaleString(
                                  undefined,
                                  {
                                    year: "numeric",
                                    month: "2-digit",
                                    day: "2-digit",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                    hour12: false,
                                    timeZoneName: "short",
                                  }
                                )}
                              </Text>
                            </Box>
                            <Group>
                              <Button
                                size="xs"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteRequest(msg.tid);
                                }}
                                color="red"
                                variant="outline"
                                loading={deletingTid === msg.tid}
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
                                textShadow: "1px 1px 1px rgba(0, 0, 0, 0.7)",
                                fontSize: "1.3rem",
                                textAlign: "center",
                              }}
                            >
                              {msg.message}
                            </Text>
                          </Center>
                          {respondingTid === msg.tid && (
                            <Stack>
                              <Textarea
                                ref={textareaRef}
                                value={responseText}
                                maxLength={characterLimit}
                                description={`${responseText.length}/${characterLimit} characters`}
                                onChange={(e) =>
                                  setResponseText(e.target.value)
                                }
                                onClick={(e) => e.stopPropagation()}
                                autosize
                                minRows={1}
                                maxRows={2}
                                onKeyDown={(event) => {
                                  if (
                                    event.key === "Enter" &&
                                    !event.shiftKey
                                  ) {
                                    event.preventDefault();
                                    handleSendResponse(msg);
                                  }
                                }}
                                inputSize="md"
                                radius="md"
                                styles={{
                                  input: {
                                    backgroundColor: "white",
                                    color: "black",
                                    border: "none",
                                    padding: "var(--mantine-spacing-xs)",
                                    borderRadius: "var(--mantine-radius-sm)",
                                    fontSize: "var(--mantine-font-size-md)",
                                    fontWeight: 500,
                                    fontFamily: "'Comic Neue', sans-serif",
                                  },
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
                                  variant="filled"
                                  radius="md"
                                >
                                  <IconSend2 />
                                </Button>
                              </Group>
                            </Stack>
                          )}
                        </Stack>
                      </Paper>
                    </Grid.Col>
                  )
                )}
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
            setDeleteModalOpened(false);
            setMessageIdToDelete(null);
          }
        }}
        onConfirm={handleConfirmDelete}
        title="Confirm Deletion"
        message="Are you sure you want to delete this message? This action cannot be undone."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        loading={deletingTid !== null && deletingTid === messageIdToDelete}
      />
    </Container>
  );
}
