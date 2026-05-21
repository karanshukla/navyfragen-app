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
  Box,
  Alert,
  Skeleton,
  Tooltip,
  CopyButton,
  useComputedColorScheme,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconSend, IconX, IconWorld, IconClipboard, IconShare } from "@tabler/icons-react";
import { useState, useRef, useEffect } from "react";
import { useParams } from "react-router-dom";

import { useSendMessage } from "../api/messageService";
import { useResolveHandle, usePublicProfile } from "../api/profileService";
import { ConfirmationModal } from "../components/ConfirmationModal";
import { WinkMark } from "../components/WinkMark";
import { ghostBg } from "../styles/tokens";
import { parseRichText } from "../utils/parseRichText";

const MAX_MESSAGE_LENGTH = 150;

interface PageAlert {
  title: string;
  message: React.ReactNode;
  color: "red" | "green" | "blue" | "yellow";
}

// Styles for the ask-card textarea (rendered on a dark gradient background)
const askCardTextareaStyles = {
  input: {
    backgroundColor: "rgba(255,255,255,0.95)",
    color: "#1a1a2e",
    border: "none",
  },
  description: {
    color: "rgba(255,255,255,0.5)",
    textAlign: "right" as const,
  },
} as const;

// Reusable SVG icon for "open in new tab" links
function ExternalLinkIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 2h3v3" />
      <path d="M21 2L10 13" />
      <path d="M21 12v6a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3h6" />
    </svg>
  );
}

export default function PublicProfile() {
  const { handle } = useParams<{ handle: string }>();
  const [message, setMessage] = useState("");
  const [modalOpened, setModalOpened] = useState(false);
  const [pageAlert, setPageAlert] = useState<PageAlert | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const askCardRef = useRef<HTMLDivElement>(null);

  const {
    data: handleData,
    isLoading: handleLoading,
    error: handleError,
  } = useResolveHandle(handle || null);

  const did = handleData?.did || null;
  const { data: profileData, isLoading: profileLoading } = usePublicProfile(did);
  const profile = profileData?.profile || null;

  const { mutate: sendMessage, isPending: sendLoading } = useSendMessage();
  const isDark = useComputedColorScheme("light", { getInitialValueInEffect: true }) === "dark";

  const handleSend = () => {
    setPageAlert(null);
    if (!message.trim()) {
      setPageAlert({ title: "Validation Error", message: "Message cannot be empty.", color: "red" });
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
      setPageAlert({ title: "Error", message: "Cannot send message: User DID not found.", color: "red" });
      setModalOpened(false);
      return;
    }
    sendMessage(
      { recipient: profileData.profile.did, message },
      {
        onSuccess: () => {
          setPageAlert({ title: "Success!", message: "Message sent! Let's go!", color: "green" });
          setMessage("");
          setModalOpened(false);
        },
        onError: (err: unknown) => {
          const e = err as Record<string, unknown>;
          setPageAlert({
            title: "Error",
            message: (typeof e?.message === "string" ? e.message : undefined)
              ?? (typeof e?.error === "string" ? e.error : undefined)
              ?? "Failed to send message. Please try again.",
            color: "red",
          });
          setModalOpened(false);
        },
      },
    );
  };

  const isLoading = handleLoading || profileLoading;

  // Scroll textarea into view on mobile when focused
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    const handleFocus = () => el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.addEventListener("focus", handleFocus);
    return () => el.removeEventListener("focus", handleFocus);
  }, []);

  // Scroll the ask card into view once the profile loads
  useEffect(() => {
    if (!isLoading && profile && askCardRef.current) {
      const rect = askCardRef.current.getBoundingClientRect();
      if (rect.bottom > window.innerHeight) {
        askCardRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
    }
  }, [isLoading, profile]);

  if (handleError) {
    const errObj = typeof handleError === "object" && handleError !== null ? handleError as unknown as Record<string, unknown> : null;
    const is404 = errObj !== null && errObj["status"] === 404;
    const errMessage = errObj !== null && typeof errObj["error"] === "string"
      ? errObj["error"]
      : "Failed to resolve handle. The handle may not exist.";
    return (
      <Container>
        <Paper p="md" withBorder>
          <Text c={is404 ? "yellow" : "red"} fw={700}>
            {is404 ? "No Bluesky account found" : "Error"}
          </Text>
          <Text>
            {is404
              ? <><strong>@{handle}</strong> doesn&apos;t exist on Bluesky. Check the handle and try again.</>
              : errMessage}
          </Text>
        </Paper>
      </Container>
    );
  }

  if (isLoading) {
    return (
      <Container>
        <Skeleton height={28} width={180} radius={999} mb="sm" />
        <Paper mb="lg" withBorder style={{ borderRadius: 16, overflow: "hidden" }}>
          <Skeleton height={160} radius={0} />
          <Box style={{ padding: "0 24px 18px", position: "relative" }}>
            <Skeleton
              circle
              height={84}
              width={84}
              style={{ position: "absolute", top: -42, left: 16, border: "4px solid var(--mantine-color-body)" }}
            />
            <Group justify="space-between" align="flex-start" pt={52}>
              <Box>
                <Skeleton height={28} width={180} mb={6} />
                <Skeleton height={14} width={120} />
              </Box>
              <Skeleton height={28} width={130} radius={999} />
            </Group>
            <Skeleton height={14} mt="sm" />
            <Skeleton height={14} mt={6} width="75%" />
          </Box>
        </Paper>
        <Paper
          style={{
            borderRadius: 18,
            padding: 28,
            background: "var(--nf-grad-dark)",
            border: "2px solid var(--mantine-color-default-border)",
          }}
        >
          <Skeleton height={26} width="70%" mx="auto" mb="lg" />
          <Skeleton height={80} radius="md" mb="xs" />
          <Group justify="flex-end" gap="xs">
            <Skeleton height={36} width={36} radius="md" />
            <Skeleton height={36} width={90} radius={999} />
          </Group>
        </Paper>
      </Container>
    );
  }

  if (did && profileData && !profileData.exists) {
    return (
      <Container>
        <Paper p="md" withBorder>
          <Text c="yellow" fw={700}>Not on Navyfragen</Text>
          <Text>
            <strong>@{handle}</strong> has a Bluesky account but hasn&apos;t set up their Navyfragen inbox yet.
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
          {/* URL breadcrumb row — pill showing fragen.navy/handle + copy/share actions */}
          <Group justify="space-between" align="center" mb="sm">
            <Box
              component="span"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                background: ghostBg(isDark),
                border: "1px solid var(--mantine-color-default-border)",
                padding: "6px 12px 6px 10px",
                borderRadius: 999,
                fontFamily: "var(--nf-font-mono)",
                fontSize: 12,
                color: "var(--mantine-color-dimmed)",
              }}
            >
              <IconWorld size={12} />
              fragen.navy/
              <Text component="span" inherit style={{ color: "var(--mantine-color-text)", fontWeight: 600 }}>
                {profile.handle}
              </Text>
            </Box>

            <Group gap="xs">
              <CopyButton value={`https://fragen.navy/${profile.handle}`}>
                {({ copied, copy }) => (
                  <Tooltip label={copied ? "Copied!" : "Copy link"} withArrow>
                    <ActionIcon
                      onClick={copy}
                      variant="subtle"
                      radius="xl"
                      size="md"
                      aria-label="Copy profile link"
                      style={{
                        background: ghostBg(isDark),
                        border: "1px solid var(--mantine-color-default-border)",
                        color: "var(--mantine-color-dimmed)",
                      }}
                    >
                      <IconClipboard size={14} />
                    </ActionIcon>
                  </Tooltip>
                )}
              </CopyButton>

              {navigator.share && (
                <ActionIcon
                  onClick={async () => {
                    try {
                      await navigator.share({
                        title: `Send ${profile.displayName || profile.handle} an anonymous message`,
                        url: `https://fragen.navy/${profile.handle}`,
                      });
                    } catch (e) {
                      if (e instanceof DOMException && e.name === "AbortError") return;
                      notifications.show({ color: "red", title: "Share failed", message: "Could not share link." });
                    }
                  }}
                  variant="subtle"
                  radius="xl"
                  size="md"
                  aria-label="Share profile link"
                  style={{
                    background: ghostBg(isDark),
                    border: "1px solid var(--mantine-color-default-border)",
                    color: "var(--mantine-color-dimmed)",
                    padding: "6px 12px",
                    fontFamily: "var(--nf-font-mono)",
                    fontSize: 12,
                  }}
                >
                  <IconShare size={14} />
                </ActionIcon>
              )}
            </Group>
          </Group>

          {/* Bluesky-style profile card */}
          <Paper mb="lg" withBorder style={{ borderRadius: 16, overflow: "hidden" }}>
            <Box
              style={{
                height: 160,
                background: profile.banner
                  ? `url(${profile.banner}) center/cover no-repeat`
                  : "var(--nf-grad-dark)",
                position: "relative",
              }}
            >
              {/* Subtle overlay on custom banners for readability */}
              {profile.banner && (
                <Box style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.2)" }} />
              )}
            </Box>

            <Box
              style={{
                padding: "0 24px 18px",
                position: "relative",
                background: ghostBg(isDark),
              }}
            >
              {/* Avatar overlapping the banner */}
              <Avatar
                src={profile.avatar}
                alt={profile.displayName || profile.handle || "User"}
                size={84}
                radius="xl"
                style={{ border: "4px solid var(--mantine-color-body)", position: "absolute", top: -42, left: 16 }}
              >
                <WinkMark size={60} sparkle={false} aria-hidden />
              </Avatar>

              {/* Name row — top-padded to clear the overlapping avatar */}
              <Group justify="space-between" align="flex-start" pt={48}>
                <Box>
                  <Text fw={800} fz={24} style={{ letterSpacing: "-0.02em", lineHeight: 1.1 }}>
                    {profile.displayName}
                  </Text>
                  <Text ff="monospace" c="dimmed" mt={2} fz={13}>
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
                  style={{ flexShrink: 0, borderColor: "var(--mantine-color-default-border)", color: "var(--mantine-color-text)" }}
                  leftSection={<ExternalLinkIcon />}
                >
                  View on Bluesky
                </Button>
              </Group>

              {profile.description && (
                <Text mt="sm" fz={14} style={{ lineHeight: 1.5, wordBreak: "break-word", whiteSpace: "pre-wrap" }}>
                  {parseRichText(profile.description)}
                </Text>
              )}
            </Box>
          </Paper>

          {/* Ask card */}
          <Paper
            ref={askCardRef}
            onClick={() => textareaRef.current?.focus()}
            style={{
              borderRadius: 18,
              padding: 28,
              background: "var(--nf-grad-dark)",
              border: "2px solid var(--mantine-color-default-border)",
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
              mb="lg"
              c="white"
              ta="center"
              fz={22}
              style={{ position: "relative", letterSpacing: "-0.01em" }}
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
                    (e.key === "Enter" && !e.shiftKey && !e.altKey && !e.metaKey) ||
                    (e.key === "Enter" && e.ctrlKey)
                  ) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                radius="md"
                styles={askCardTextareaStyles}
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
                  radius="xl"
                  leftSection={<IconSend size={16} />}
                  color="sunshine"
                  variant="filled"
                  style={{
                    color: "var(--nf-midnight)",
                    fontFamily: "var(--nf-font-mono)",
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

          {/* Anonymity disclaimer */}
          <Group
            gap="xs"
            mt="md"
            align="flex-start"
            style={{ background: ghostBg(isDark), borderRadius: 12, padding: "12px 14px" }}
          >
            <Text size="xs" c="dimmed">
              Your message will be sent anonymously to the user. They may post it publicly on Bluesky,
              so please don&apos;t share any personal information or passwords. Be curious, but respectful and kind!
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
          <Text c="red" fw={700}>Error</Text>
          <Text>Failed to load profile information.</Text>
        </Paper>
      )}
    </Container>
  );
}
