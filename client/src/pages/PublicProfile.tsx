import { useState, useRef, useEffect } from "react";
import {
  Container,
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
} from "@mantine/core";
import { useParams } from "react-router-dom";
import {
  useResolveHandle,
  useUserExists,
  usePublicProfile,
} from "../api/profileService";
import { useSendMessage } from "../api/messageService";
import { ConfirmationModal } from "../components/ConfirmationModal";
import { IconSend, IconX, IconWorld, IconLock } from "@tabler/icons-react";
import { parseRichText } from "../utils/parseRichText";
import { WinkMark } from "../components/WinkMark";

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
          {/* URL breadcrumb pill */}
          <Group justify="space-between" align="center" mb="sm">
            <Box
              component="span"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                background: "var(--mantine-color-default)",
                border: "1px solid var(--mantine-color-default-border)",
                padding: "6px 12px 6px 10px",
                borderRadius: 999,
                fontFamily: "JetBrains Mono, monospace",
                fontSize: 12,
                color: "var(--mantine-color-dimmed)",
              }}
            >
              <IconWorld size={12} />
              fragen.navy/<Text component="span" inherit style={{ color: "var(--mantine-color-text)", fontWeight: 600 }}>{profile.handle}</Text>
            </Box>
          </Group>

          {/* Bluesky-style profile card */}
          <Paper radius="lg" mb="lg" withBorder style={{ overflow: "hidden" }}>
            {/* Banner */}
            <Box
              style={{
                height: 160,
                background: profile.banner
                  ? `url(${profile.banner}) center/cover no-repeat`
                  : "linear-gradient(115deg, #1E1B4B 0%, #3B2E78 45%, #8B5CF6 100%)",
                position: "relative",
              }}
            >
              {/* Subtle overlay on banners for readability */}
              {profile.banner && (
                <Box
                  style={{
                    position: "absolute",
                    inset: 0,
                    background: "rgba(0,0,0,0.2)",
                  }}
                />
              )}
            </Box>

            {/* Profile content below banner */}
            <Box p="md" style={{ position: "relative" }}>
              {/* Avatar — overlaps the banner */}
              <Avatar
                src={profile.avatar}
                alt={profile.displayName || profile.handle || "User"}
                size={84}
                radius="xl"
                style={{
                  border: "4px solid var(--mantine-color-body)",
                  position: "absolute",
                  top: -42,
                  left: 16,
                }}
              >
                <WinkMark size={60} sparkle={false} aria-hidden />
              </Avatar>

              {/* Name row — padded to clear the avatar */}
              <Group justify="space-between" align="flex-start" pt={48}>
                <Box>
                  <Text fw={800} size="xl" lh={1.1} style={{ letterSpacing: "-0.02em" }}>
                    {profile.displayName}
                  </Text>
                  <Text size="sm" c="dimmed" ff="monospace" mt={2}>
                    @{profile.handle}
                  </Text>
                </Box>
                <Button
                  component="a"
                  href={`https://bsky.app/profile/${profile.handle}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  variant="outline"
                  size="xs"
                  radius="xl"
                  style={{
                    flexShrink: 0,
                    borderColor: "var(--mantine-color-default-border)",
                    color: "var(--mantine-color-text)",
                  }}
                  leftSection={
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M18 2h3v3"/><path d="M21 2L10 13"/><path d="M21 12v6a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3h6"/>
                    </svg>
                  }
                >
                  View on Bluesky
                </Button>
              </Group>

              {profile.description && (
                <Text
                  mt="sm"
                  size="sm"
                  c="dimmed"
                  style={{ wordBreak: "break-word", whiteSpace: "pre-wrap" }}
                >
                  {parseRichText(profile.description)}
                </Text>
              )}
            </Box>
          </Paper>

          {/* Ask card */}
          <Paper
            p="xl"
            radius="lg"
            shadow="md"
            onClick={() => textareaRef.current?.focus()}
            style={{
              background: "linear-gradient(135deg, #1E1B4B 0%, #3B2E78 55%, #6B3FD4 100%)",
              border: "2px solid rgba(255,255,255,0.06)",
              cursor: "text",
              position: "relative",
              overflow: "hidden",
            }}
          >
            {/* WinkMark watermark */}
            <Box style={{ position: "absolute", right: -30, top: -30, opacity: 0.12, pointerEvents: "none" }}>
              <WinkMark size={220} sparkle={false} aria-hidden />
            </Box>
            <Text
              fw={700}
              size="lg"
              mb="lg"
              c="white"
              ta="center"
              style={{ position: "relative", fontFamily: "Inter", fontSize: 20, letterSpacing: "-0.01em" }}
            >
              Send {profile.displayName || profile.handle} an anonymous message
            </Text>

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
                {/* Sunshine Send button */}
                <Button
                  onClick={(e) => { e.stopPropagation(); handleSend(); }}
                  loading={sendLoading}
                  radius="md"
                  leftSection={<IconSend size={16} />}
                  style={{
                    background: "#FACC15",
                    color: "#1E1B4B",
                    fontFamily: "JetBrains Mono, monospace",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                  }}
                >
                  Send
                </Button>
              </Group>
            </Stack>
          </Paper>

          {/* Lock icon disclaimer */}
          <Group
            gap="xs"
            mt="md"
            align="flex-start"
            style={{
              background: "var(--mantine-color-default)",
              borderRadius: 12,
              padding: "12px 14px",
            }}
          >
            <IconLock size={16} style={{ marginTop: 2, flexShrink: 0, opacity: 0.5 }} />
            <Text size="xs" c="dimmed">
              Your message will be sent anonymously to the user. They may post it
              publicly on Bluesky, so please don't share any personal information
              or passwords. Be curious, but respectful and kind!
            </Text>
          </Group>

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
