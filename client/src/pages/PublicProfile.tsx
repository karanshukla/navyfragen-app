import { useState, useRef, useEffect } from "react";
import {
  Container,
  Title,
  Text,
  Paper,
  Stack,
  Button,
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
            User not found
          </Text>
          <Text>This user hasn't set up their Navyfragen inbox yet.</Text>
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
            p="md"
            withBorder
            mb="lg"
            style={{ position: "relative", overflow: "hidden" }}
          >
            <BackgroundImage
              src={profile.banner || ""}
              style={{
                filter: "blur(8px) brightness(0.5)",
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
                backgroundColor: "rgba(0, 0, 0, 0.5)",
                zIndex: 2,
              }}
            />
            <Box
              style={{
                position: "relative",
                zIndex: 3,
                padding: "var(--mantine-spacing-md)",
              }}
            >
              {/* Desktop Layout */}
              <Box visibleFrom="sm">
                <Group>
                  <Avatar
                    src={profile.avatar}
                    alt={profile.displayName || profile.handle || "User"}
                    size="xl"
                    radius="xl"
                    style={{ border: "2px solid white" }}
                  />
                  <Box style={{ flex: 1 }}>
                    <Title
                      order={3}
                      c="white"
                      style={{
                        textShadow: "2px 2px 4px rgba(0,0,0,0.7)",
                      }}
                    >
                      {profile.displayName}
                    </Title>
                    <Text
                      c="white"
                      style={{
                        textShadow: "1px 1px 3px rgba(0,0,0,0.7)",
                      }}
                    >
                      <Anchor
                        href={`https://bsky.app/profile/${profile.handle}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        c="white"
                        style={{
                          textShadow: "1px 1px 3px rgba(0,0,0,0.7)",
                        }}
                      >
                        @{profile.handle}
                      </Anchor>
                    </Text>
                    {profile.description && (
                      <Text
                        mt="xs"
                        c="white"
                        style={{
                          wordBreak: "break-word",
                          whiteSpace: "pre-wrap",
                          textShadow: "1px 1px 3px rgba(0,0,0,0.7)",
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
                    size={100}
                    radius="xl"
                    style={{
                      border: "3px solid white",
                      boxShadow: "0px 4px 10px rgba(0, 0, 0, 0.3)", // Add shadow for depth
                    }}
                  />
                  <Title
                    order={4}
                    c="white"
                    ta="center"
                    style={{
                      textShadow: "2px 2px 4px rgba(0,0,0,0.7)",
                      marginTop: "var(--mantine-spacing-xs)",
                    }}
                  >
                    {profile.displayName}
                  </Title>
                  <Text
                    c="white"
                    ta="center"
                    style={{
                      textShadow: "1px 1px 3px rgba(0,0,0,0.7)",
                    }}
                  >
                    <Anchor
                      href={`https://bsky.app/profile/${profile.handle}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      c="white"
                      style={{
                        textShadow: "1px 1px 3px rgba(0,0,0,0.7)",
                      }}
                    >
                      @{profile.handle}
                    </Anchor>
                  </Text>
                  {profile.description && (
                    <Text
                      mt="xs"
                      c="white"
                      ta="center"
                      size="sm"
                      style={{
                        wordBreak: "break-word",
                        whiteSpace: "pre-wrap",
                        textShadow: "1px 1px 3px rgba(0,0,0,0.7)",
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
            p="md"
            withBorder
            style={{
              background: "linear-gradient(to right, #005299, #7700aa)",
            }}
            onClick={() => textareaRef.current?.focus()}
          >
            <Title
              order={4}
              mb="md"
              c="white"
              ta="center"
              style={{ textShadow: "1px 1px 3px rgba(0,0,0,0.7)" }}
            >
              Send an anonymous message or question!
            </Title>

            <Stack>
              <Text size="sm" ta="right" c="white">
                {message.length}/{MAX_MESSAGE_LENGTH}
              </Text>
              <Textarea
                ref={textareaRef}
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
                variant="unstyled"
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
                  onClick={() => setMessage("")}
                  variant="filled"
                  size="md"
                  radius="md"
                >
                  <IconX />
                </Button>
                <Button
                  onClick={handleSend}
                  loading={sendLoading}
                  variant="filled"
                  size="md"
                  radius="md"
                >
                  <IconSend />
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
