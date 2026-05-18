import { useState, useRef, useEffect } from "react";
import {
  Container,
  Title,
  Text,
  Paper,
  Stack,
  Button,
  ActionIcon,
  Group,
  Textarea,
  Avatar,
  Loader,
  Center,
  Box,
  Alert,
  BackgroundImage,
  Divider,
  Anchor,
} from "@mantine/core";
import { useParams } from "react-router-dom";
import {
  useResolveHandle,
  useUserExists,
  usePublicProfile,
} from "../api/profileService";
import { useSendMessage } from "../api/messageService";
import { ConfirmationModal } from "../components/ConfirmationModal";
import { IconSend, IconX } from "@tabler/icons-react";
import { parseRichText } from "../utils/parseRichText";

const MAX_MESSAGE_LENGTH = 150;

interface PageAlert {
  title: string;
  message: React.ReactNode;
  color: "red" | "green" | "blue" | "yellow";
}

export default function PublicProfile() {
  const { handle } = useParams<{ handle: string }>();
  const [message, setMessage] = useState("");
  const [modalOpened, setModalOpened] = useState(false);
  const [pageAlert, setPageAlert] = useState<PageAlert | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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

  const { mutate: sendMessage, isPending: sendLoading } = useSendMessage();

  const handleSend = () => {
    setPageAlert(null);
    if (!message.trim()) {
      setPageAlert({
        title: "Validation Error",
        message: "Message cannot be empty.",
        color: "red",
      });
      return;
    }
    if (message.length > MAX_MESSAGE_LENGTH) {
      setPageAlert({
        title: "Validation Error",
        message: `Message cannot be longer than ${MAX_MESSAGE_LENGTH} characters.`,
        color: "red",
      });
      return;
    }
    setModalOpened(true);
  };

  const handleConfirmSend = () => {
    setPageAlert(null);
    if (!profileData?.profile?.did) {
      setPageAlert({
        title: "Error",
        message: "Cannot send message: User DID not found.",
        color: "red",
      });
      setModalOpened(false);
      return;
    }
    sendMessage(
      { recipient: profileData.profile.did, message },
      {
        onSuccess: () => {
          setPageAlert({
            title: "Success!",
            message: "Message sent! Let's go!",
            color: "green",
          });
          setMessage("");
          setModalOpened(false);
        },
        onError: (err: any) => {
          setPageAlert({
            title: "Error",
            message:
              err.message ||
              err.error ||
              "Failed to send message. Please try again.",
            color: "red",
          });
          setModalOpened(false);
        },
      }
    );
  };

  // Combined loading state
  const isLoading =
    handleLoading || userExistsLoading || profileLoading || sendLoading;

  useEffect(() => {
    const handleFocus = () => {
      if (textareaRef.current) {
        textareaRef.current.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      }
    };

    const textareaElement = textareaRef.current;
    if (textareaElement) {
      textareaElement.addEventListener("focus", handleFocus);
    }

    return () => {
      if (textareaElement) {
        textareaElement.removeEventListener("focus", handleFocus);
      }
    };
  }, []);

  if (handleError) {
    const is404 =
      typeof handleError === "object" &&
      handleError !== null &&
      (handleError as any).status === 404;
    if (is404) {
      return (
        <Container>
          <Paper p="md" withBorder>
            <Text c="yellow" fw={700}>
              No Bluesky account found
            </Text>
            <Text>
              <strong>@{handle}</strong> doesn't exist on Bluesky. Check the
              handle and try again.
            </Text>
          </Paper>
        </Container>
      );
    }
    return (
      <Container>
        <Paper p="md" withBorder>
          <Text c="red" fw={700}>
            Error
          </Text>
          <Text>
            {typeof handleError === "object" &&
            handleError !== null &&
            "error" in handleError
              ? (handleError as any).error
              : "Failed to resolve handle. The handle may not exist."}
          </Text>
        </Paper>
      </Container>
    );
  }

  if (isLoading) {
    return (
      <Container>
        <Center style={{ minHeight: "200px" }}>
          <Loader />
        </Center>
      </Container>
    );
  }

  if (did && !userExists) {
    return (
      <Container>
        <Paper p="md" withBorder>
          <Text c="yellow" fw={700}>
            Not on Navyfragen
          </Text>
          <Text>
            <strong>@{handle}</strong> has a Bluesky account but hasn't set up
            their Navyfragen inbox yet.
          </Text>
        </Paper>
      </Container>
    );
  }

  return (
    <Container>
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

      {profile ? (
        <>
          <Paper
            radius="lg"
            mb="lg"
            shadow="md"
            style={{ position: "relative", overflow: "hidden" }}
          >
            <BackgroundImage
              src={profile.banner || ""}
              style={{
                filter: "blur(8px) brightness(0.4)",
                position: "absolute",
                top: -10,
                left: -10,
                right: -10,
                bottom: -10,
                zIndex: 1,
              }}
            />
            <Box
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: profile.banner
                  ? "rgba(0,0,0,0.35)"
                  : "linear-gradient(135deg, #1a5fb4 0%, #6e2fa0 100%)",
                zIndex: 2,
              }}
            />
            <Box
              style={{
                position: "relative",
                zIndex: 3,
                padding: "var(--mantine-spacing-lg)",
              }}
            >
              {/* Desktop Layout */}
              <Box visibleFrom="sm">
                <Group align="center">
                  <Avatar
                    src={profile.avatar}
                    alt={profile.displayName || profile.handle || "User"}
                    size="xl"
                    radius="xl"
                    style={{ border: "2px solid rgba(255,255,255,0.8)" }}
                  />
                  <Box style={{ flex: 1 }}>
                    <Title order={3} c="white">
                      {profile.displayName}
                    </Title>
                    <Anchor
                      href={`https://bsky.app/profile/${profile.handle}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: "rgba(255,255,255,0.7)", fontSize: "var(--mantine-font-size-sm)" }}
                    >
                      @{profile.handle}
                    </Anchor>
                    {profile.description && (
                      <Text
                        mt="xs"
                        size="sm"
                        style={{
                          color: "rgba(255,255,255,0.85)",
                          wordBreak: "break-word",
                          whiteSpace: "pre-wrap",
                        }}
                      >
                        {parseRichText(profile.description)}
                      </Text>
                    )}
                  </Box>
                </Group>
              </Box>

              {/* Mobile Layout */}
              <Box hiddenFrom="sm">
                <Stack align="center" gap="sm">
                  <Avatar
                    src={profile.avatar}
                    alt={profile.displayName || profile.handle || "User"}
                    size={90}
                    radius="xl"
                    style={{ border: "2px solid rgba(255,255,255,0.8)" }}
                  />
                  <Title order={4} c="white" ta="center">
                    {profile.displayName}
                  </Title>
                  <Anchor
                    href={`https://bsky.app/profile/${profile.handle}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    ta="center"
                    style={{ color: "rgba(255,255,255,0.7)", fontSize: "var(--mantine-font-size-sm)" }}
                  >
                    @{profile.handle}
                  </Anchor>
                  {profile.description && (
                    <Text
                      size="sm"
                      ta="center"
                      style={{
                        color: "rgba(255,255,255,0.85)",
                        wordBreak: "break-word",
                        whiteSpace: "pre-wrap",
                      }}
                    >
                      {parseRichText(profile.description)}
                    </Text>
                  )}
                </Stack>
              </Box>
            </Box>
          </Paper>

          <Paper
            p="lg"
            radius="lg"
            shadow="md"
            onClick={() => textareaRef.current?.focus()}
            style={{
              background: "linear-gradient(135deg, #1a5fb4 0%, #6e2fa0 100%)",
              border: "2px solid rgba(255,255,255,0.08)",
              cursor: "text",
            }}
          >
            <Title order={4} mb="md" c="white" ta="center">
              Send an anonymous message or question!
            </Title>

            <Stack gap="xs">
              <Textarea
                ref={textareaRef}
                value={message}
                onChange={(e) => {
                  if (e.target.value.length <= MAX_MESSAGE_LENGTH) {
                    setMessage(e.target.value);
                  }
                }}
                minRows={2}
                maxRows={4}
                autosize
                disabled={sendLoading}
                placeholder="Ask something…"
                description={`${message.length}/${MAX_MESSAGE_LENGTH}`}
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
                radius="md"
                styles={{
                  input: {
                    backgroundColor: "rgba(255,255,255,0.95)",
                    color: "#1a1a2e",
                    border: "none",
                  },
                  description: {
                    color: "rgba(255,255,255,0.5)",
                    textAlign: "right",
                  },
                }}
              />
              <Group justify="flex-end" gap="xs">
                <ActionIcon
                  onClick={(e) => { e.stopPropagation(); setMessage(""); }}
                  variant="subtle"
                  color="white"
                  size="lg"
                  radius="md"
                  aria-label="Clear message"
                >
                  <IconX size={18} />
                </ActionIcon>
                <Button
                  onClick={(e) => { e.stopPropagation(); handleSend(); }}
                  loading={sendLoading}
                  variant="white"
                  color="dark"
                  radius="md"
                  leftSection={<IconSend size={16} />}
                >
                  Send
                </Button>
              </Group>
            </Stack>
          </Paper>
          <Divider my="md" />
          <Text size="xs" c="dimmed">
            Your message will be sent anonymously to the user. They may post it
            publicly on Bluesky, so please don't share any personal information
            or passwords. Be curious, but respectful and kind!
          </Text>
          <ConfirmationModal
            opened={modalOpened}
            onClose={() => setModalOpened(false)}
            onConfirm={handleConfirmSend}
            title="Confirm Anonymous Message"
            message="Are you sure you want to send this anonymous message? This action cannot be undone."
            confirmLabel="Send Message"
            cancelLabel="Cancel"
          />
        </>
      ) : (
        <Paper p="md" withBorder>
          <Text c="red" fw={700}>
            Error
          </Text>
          <Text>Failed to load profile information.</Text>
        </Paper>
      )}
    </Container>
  );
}
