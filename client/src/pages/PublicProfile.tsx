import { useState } from "react";
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
  useMantineColorScheme,
  Box,
  Alert,
  BackgroundImage,
  Divider,
  Anchor, // ADDED for page-level alerts
} from "@mantine/core";
import { useParams } from "react-router-dom";
import {
  useResolveHandle,
  useUserExists,
  usePublicProfile,
} from "../api/profileService";
import { useSendMessage } from "../api/messageService";
import { ConfirmationModal } from "../components/ConfirmationModal";
import { IconCheck, IconSend } from "@tabler/icons-react";

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
  const { colorScheme } = useMantineColorScheme();
  const [pageAlert, setPageAlert] = useState<PageAlert | null>(null); // ADDED for page-level alerts

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
    setPageAlert(null); // Clear previous alert
    if (!message.trim()) {
      setPageAlert({
        // MODIFIED
        title: "Validation Error",
        message: "Message cannot be empty.",
        color: "red",
      });
      return;
    }
    if (message.length > MAX_MESSAGE_LENGTH) {
      setPageAlert({
        // MODIFIED
        title: "Validation Error",
        message: `Message cannot be longer than ${MAX_MESSAGE_LENGTH} characters.`,
        color: "red",
      });
      return;
    }
    setModalOpened(true);
  };

  const handleConfirmSend = () => {
    setPageAlert(null); // Clear previous alert
    if (!profileData?.profile?.did) {
      setPageAlert({
        // MODIFIED
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
            // MODIFIED
            title: "Success!",
            message: "Message sent! Let's go!",
            color: "green",
          });
          setMessage("");
          setModalOpened(false);
        },
        onError: (err: any) => {
          setPageAlert({
            // MODIFIED
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

  // Display error if handle resolution fails
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
      {/* Page-level alert */}
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
                filter: "blur(8px)",
                position: "absolute",
                top: -10, // Extend a bit to avoid blurred edges
                left: -10,
                right: -10,
                bottom: -10,
                zIndex: 1,
              }}
            />
            {/* Dark overlay */}
            <Box
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: "rgba(0, 0, 0, 0.5)", // Darken the image
                zIndex: 2,
              }}
            />
            {/* Content on top */}
            <Box
              style={{
                position: "relative",
                zIndex: 3,
                padding: "var(--mantine-spacing-md)",
              }}
            >
              <Group>
                <Avatar
                  src={profile.avatar}
                  alt={profile.displayName || profile.handle || "User"}
                  size="xl"
                  radius="xl"
                  style={{ border: "2px solid white" }} // Added border to avatar for better visibility
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
                      {profile.description}
                    </Text>
                  )}
                </Box>
              </Group>
            </Box>
          </Paper>

          <Paper
            p="md"
            withBorder
            style={{
              background: "linear-gradient(to right, #005299, #7700aa)",
            }}
          >
            <Title
              order={4}
              mb="md"
              c={colorScheme === "dark" ? "white" : "black"}
            >
              Send an anonymous message
            </Title>

            <Stack>
              <Text size="sm" ta="right" c="white">
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
                  variant="outline"
                  size="md"
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
