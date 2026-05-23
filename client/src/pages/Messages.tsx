import {
  Title,
  Text,
  Paper,
  Stack,
  Loader,
  Center,
  Alert,
  Button,
  ActionIcon,
  Group,
  Textarea,
  CopyButton,
  Tooltip,
  Switch,
  Box,
  SimpleGrid,
  useComputedColorScheme,
  Collapse,
} from "@mantine/core";
import { useLocalStorage } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import {
  IconChevronDown,
  IconClipboard,
  IconSend2,
  IconTrash,
} from "@tabler/icons-react";
import { useEffect, useState, useRef } from "react";

import { ApiError } from "../api/apiClient";
import { useSession } from "../api/authService";
import {
  useMessages,
  useDeleteMessage,
  useRespondToMessage,
  useAddExampleMessages,
  Message,
} from "../api/messageService";
import { useUserSettings, useUpdateUserSettings } from "../api/settingsService";
import { ConfirmationModal } from "../components/ConfirmationModal";
import ShareButton from "../components/ShareButton";
import { WinkMark } from "../components/WinkMark";
import { themes } from "../lib/themes";
import { surfaceBg } from "../styles/tokens";

// Styles for the reply textarea inside the response box (white card on dark background)
const replyTextareaStyles = {
  input: { background: "transparent", color: "var(--nf-midnight)", border: "none", padding: 0 },
} as const;

const shortlinkurl =
  import.meta.env.VITE_SHORTLINK_URL || "localhost:5173/profile";

const MAX_BSKY_POST_LENGTH = 280;
const GENERAL_BUFFER = 3;

export function formatTimestamp(dateStr: string): string {
  return new Date(dateStr).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  });
}

/** SVG circular character-count progress ring */
function CharRing({ count, limit }: { count: number; limit: number }) {
  const r = 9;
  const circ = 2 * Math.PI * r;
  const pct = Math.min(count / limit, 1);
  const danger = count > limit * 0.9;
  const color = danger ? "var(--nf-sunshine)" : "var(--nf-royal)";
  return (
    <svg width={22} height={22} viewBox="0 0 22 22" style={{ flexShrink: 0 }}>
      <circle
        cx={11}
        cy={11}
        r={r}
        fill="none"
        stroke="rgba(253,248,255,0.15)" /* track */
        strokeWidth={2.5}
      />
      <circle
        cx={11}
        cy={11}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={2.5}
        strokeDasharray={circ}
        strokeDashoffset={circ - pct * circ}
        transform="rotate(-90 11 11)"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** Visual image theme picker card */
function ThemeCard({
  value,
  label,
  selected,
  onClick,
}: {
  value: string;
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  function PreviewContent() {
    if (value === "default") {
      return (
        <div
          style={{
            background: "var(--nf-grad-dark)",
            height: "100%",
            borderRadius: 5,
            display: "flex",
            flexDirection: "column",
            alignItems: "stretch",
            justifyContent: "center",
            padding: "8px 10px",
            gap: 6,
          }}
        >
          <div style={{ display: "flex", justifyContent: "center" }}>
            <div
              style={{
                height: 2.5,
                background: "rgba(255,255,255,0.7)",
                borderRadius: 2,
                width: "55%",
              }}
            />
          </div>
          <div
            style={{
              background: "#fff",
              borderRadius: 8,
              padding: "6px 10px",
              boxShadow: "0 3px 10px rgba(0,0,0,0.3)",
            }}
          >
            <div
              style={{
                height: 3.5,
                background: "#ccc",
                borderRadius: 2,
                marginBottom: 4,
              }}
            />
            <div
              style={{
                height: 3.5,
                background: "#ccc",
                borderRadius: 2,
                width: "65%",
              }}
            />
          </div>
          <div style={{ display: "flex", justifyContent: "center" }}>
            <div
              style={{
                height: 2,
                background: "rgba(255,255,255,0.4)",
                borderRadius: 2,
                width: "40%",
              }}
            />
          </div>
        </div>
      );
    }
    if (value === "compressed") {
      return (
        <div
          style={{
            background: "#1a1a2a",
            height: "100%",
            borderRadius: 5,
            display: "flex",
            alignItems: "center",
            padding: 8,
          }}
        >
          <div
            style={{
              background: "#22223a",
              borderLeft: "3px solid #7c3aed",
              borderRadius: 6,
              padding: "7px 9px",
              width: "100%",
            }}
          >
            <div
              style={{
                height: 3,
                background: "#a78bfa",
                borderRadius: 3,
                marginBottom: 5,
                width: "45%",
              }}
            />
            <div
              style={{
                height: 3,
                background: "#4a4a6a",
                borderRadius: 3,
                marginBottom: 3,
              }}
            />
            <div
              style={{
                height: 3,
                background: "#4a4a6a",
                borderRadius: 3,
                width: "70%",
                marginBottom: 5,
              }}
            />
            <div
              style={{
                height: 2.5,
                background: "#3a3a5a",
                borderRadius: 2,
                width: "45%",
              }}
            />
          </div>
        </div>
      );
    }
    // twitter
    return (
      <div
        style={{
          background: "#ffffff",
          height: "100%",
          borderRadius: 5,
          display: "flex",
          alignItems: "center",
          padding: 0,
        }}
      >
        <div
          style={{
            background: "#fff",
            border: "1px solid #cfd9de",
            borderRadius: 8,
            padding: "7px 9px",
            width: "100%",
          }}
        >
          <div
            style={{
              display: "flex",
              gap: 5,
              marginBottom: 5,
              alignItems: "center",
            }}
          >
            <div
              style={{
                width: 12,
                height: 12,
                borderRadius: "50%",
                background: "#1d9bf0",
                flexShrink: 0,
              }}
            />
            <div style={{ flex: 1 }}>
              <div
                style={{
                  height: 2.5,
                  background: "#333",
                  borderRadius: 2,
                  marginBottom: 2,
                }}
              />
              <div
                style={{
                  height: 2.5,
                  background: "#aaa",
                  borderRadius: 2,
                  width: "55%",
                }}
              />
            </div>
          </div>
          <div
            style={{
              height: 2.5,
              background: "#ccc",
              borderRadius: 2,
              marginBottom: 3,
            }}
          />
          <div
            style={{
              height: 2.5,
              background: "#ccc",
              borderRadius: 2,
              width: "75%",
              marginBottom: 4,
            }}
          />
          <div style={{ height: 1, background: "#eff3f4", marginBottom: 3 }} />
          <div
            style={{
              height: 2.5,
              background: "#1d9bf0",
              borderRadius: 2,
              width: "40%",
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <button
      onClick={onClick}
      style={{
        background: selected ? "rgba(59,91,255,0.12)" : "transparent",
        border: selected
          ? "1.5px solid #3B5BFF"
          : "1.5px solid var(--mantine-color-default-border)",
        borderRadius: 10,
        padding: 8,
        cursor: "pointer",
        display: "flex",
        flexDirection: "column",
        gap: 6,
        flex: 1,
      }}
    >
      <div style={{ aspectRatio: "4/3", borderRadius: 5, overflow: "hidden" }}>
        <PreviewContent />
      </div>
      <Text
        size="xs"
        fw={600}
        ta="center"
        style={{ color: "var(--mantine-color-text)" }}
      >
        {label}
      </Text>
    </button>
  );
}

export default function Messages() {
  const [respondingTid, setRespondingTid] = useState<string | null>(null);
  const [responseText, setResponseText] = useState<string>("");
  const [focusedCardIndex, setFocusedCardIndex] = useState<number>(-1);
  const [postingPrefsOpen, setPostingPrefsOpen] = useState(true);
  const [imageThemeOpen, setImageThemeOpen] = useState(true);
  const messageCardRefs = useRef<(HTMLDivElement | null)[]>([]);
  const isDark = useComputedColorScheme("light", { getInitialValueInEffect: true }) === "dark";

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
  const [autoScrollToMessages, setAutoScrollToMessages] = useLocalStorage({
    key: "autoScrollToMessages",
    defaultValue: true,
    getInitialValueInEffect: true,
  });

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesTopRef = useRef<HTMLDivElement>(null);
  const prevMsgCountRef = useRef<number>(0);
  const [deleteModalOpened, setDeleteModalOpened] = useState<boolean>(false);
  const [messageIdToDelete, setMessageIdToDelete] = useState<string | null>(
    null,
  );
  const [characterLimit, setCharacterLimit] = useState<number>(280);
  const [deletingTid, setDeletingTid] = useState<string | null>(null);

  const { data: session, isLoading: sessionLoading } = useSession();

  const {
    data: messagesData,
    isLoading: messagesLoading,
    refetch: refetchMessages,
  } = useMessages(session?.did || null, {
    refetchInterval: 10000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });

  const { mutate: deleteMessage, isPending: deleteLoading } =
    useDeleteMessage();
  const { mutate: respondToMessage, isPending: respondLoading } =
    useRespondToMessage();
  const { mutate: addExamples, isPending: examplesLoading } =
    useAddExampleMessages();

  const { data: userSettings, isLoading: settingsLoading } = useUserSettings();
  const updateSettings = useUpdateUserSettings({
    onError: (error: ApiError) => {
      notifications.show({
        title: "Error updating theme",
        message: error.error || "Failed to update image theme.",
        color: "red",
      });
    },
  });

  useEffect(() => {
    let maxLength = MAX_BSKY_POST_LENGTH - GENERAL_BUFFER;
    if (appendProfileLink && session?.profile?.handle) {
      maxLength -= ` ${shortlinkurl}/${session.profile.handle}`.length;
    }
    if (!includeQuestionAsImage && respondingTid && messagesData?.messages) {
      const msg = messagesData.messages.find((m) => m.tid === respondingTid);
      if (msg) {
        maxLength -= ` \\n\\nAnon asked via 💙📩❓: *${msg.message}*`.length;
      }
    }
    setCharacterLimit(Math.max(0, maxLength));
  }, [
    appendProfileLink,
    session?.profile?.handle,
    includeQuestionAsImage,
    respondingTid,
    messagesData,
  ]);

  useEffect(() => {
    const isNewLogin = sessionStorage.getItem("newLogin");
    if (isNewLogin === "true") {
      notifications.show({
        title: "Welcome back!",
        message: "You have successfully logged in.",
        color: "green",
      });
      sessionStorage.removeItem("newLogin");
    }
  }, []);

  const handleAddExampleMessages = () => {
    if (!session?.did) return;
    addExamples(session.did, {
      onSuccess: () => refetchMessages(),
      onError: (err: any) => {
        notifications.show({
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

  const performDelete = (tid: string, fromModal = false) => {
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
        notifications.show({
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
    if (messageIdToDelete) performDelete(messageIdToDelete, true);
  };

  const handlePrepareResponse = (tid: string) => {
    setRespondingTid(tid);
    setResponseText("");
    const idx = messagesData?.messages.findIndex((m) => m.tid === tid);
    if (idx !== undefined && idx !== -1) setFocusedCardIndex(idx);
  };

  const handleSendResponse = (msg: Message) => {
    if (!responseText.trim()) {
      notifications.show({
        title: "Empty Response",
        message: "Response cannot be empty.",
        color: "yellow",
      });
      return;
    }
    const text =
      appendProfileLink && session?.profile?.handle
        ? responseText + ` ${shortlinkurl}/${session.profile.handle}`
        : responseText;

    respondToMessage(
      {
        tid: msg.tid,
        recipient: msg.recipient,
        original: msg.message,
        response: text,
        includeQuestionAsImage,
      },
      {
        onSuccess: (data) => {
          setRespondingTid(null);
          setResponseText("");
          const successMsg: React.ReactNode = data.link ? (
            <>
              Your response has been posted.{" "}
              <a
                href={data.link}
                target="_blank"
                rel="noreferrer"
                style={{ color: "inherit", textDecoration: "underline" }}
              >
                {data.link}
              </a>
            </>
          ) : (
            "Your response has been posted."
          );
          notifications.show({
            title: "Response Sent!",
            message: successMsg,
            color: "green",
            autoClose: 8000,
          });
          refetchMessages();
        },
        onError: (err: any) => {
          notifications.show({
            title: "Response Error",
            message: err.error || "Failed to send response.",
            color: "red",
          });
        },
      },
    );
  };

  useEffect(() => {
    if (respondingTid && textareaRef.current) {
      textareaRef.current.focus();
      const el = document.getElementById(`message-card-${respondingTid}`);
      if (el)
        setTimeout(
          () => el.scrollIntoView({ behavior: "smooth", block: "nearest" }),
          150,
        );
    }
  }, [respondingTid]);

  useEffect(() => {
    if (messagesData?.messages) {
      messageCardRefs.current = messagesData.messages.map(() => null);
    }
  }, [messagesData]);

  useEffect(() => {
    const messages = messagesData?.messages;
    const count = messages?.length ?? 0;
    const prev = prevMsgCountRef.current;
    prevMsgCountRef.current = count;
    if (autoScrollToMessages && count > prev && messages?.[0]) {
      const newestCard = document.getElementById(
        `message-card-${messages[0].tid}`,
      );
      const target = newestCard ?? messagesTopRef.current;
      if (target) {
        const { top, bottom } = target.getBoundingClientRect();
        if (top >= window.innerHeight || bottom <= 0) {
          target.scrollIntoView({ behavior: "smooth", block: "nearest" });
        }
      }
    }
  }, [messagesData, autoScrollToMessages]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const tag = (event.target as HTMLElement)?.nodeName;

      // Escape always collapses the expanded card, even from inside a textarea.
      // The textarea's own onKeyDown fires first and calls stopPropagation, so
      // Escape from the textarea is handled there — this catches other child elements.
      if (event.key === "Escape" && respondingTid) {
        event.preventDefault();
        const idx =
          messagesData?.messages.findIndex((m) => m.tid === respondingTid) ??
          -1;
        setRespondingTid(null);
        if (idx !== -1) messageCardRefs.current[idx]?.focus();
        return;
      }

      if (["INPUT", "TEXTAREA", "SELECT"].includes(tag)) return;

      if ((event.altKey || event.metaKey) && event.key.toUpperCase() === "R") {
        event.preventDefault();
        if (messagesData?.messages?.length) {
          const newIdx =
            focusedCardIndex === -1
              ? 0
              : (focusedCardIndex + 1) % messagesData.messages.length;
          setFocusedCardIndex(newIdx);
          messageCardRefs.current[newIdx]?.focus();
        }
      }
      if (
        focusedCardIndex !== -1 &&
        (event.key === "ArrowDown" || event.key === "ArrowUp")
      ) {
        event.preventDefault();
        if (messagesData?.messages?.length) {
          const newIdx =
            event.key === "ArrowDown"
              ? (focusedCardIndex + 1) % messagesData.messages.length
              : (focusedCardIndex - 1 + messagesData.messages.length) %
                messagesData.messages.length;
          setFocusedCardIndex(newIdx);
          messageCardRefs.current[newIdx]?.focus();
        }
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [focusedCardIndex, messagesData, respondingTid]);

  const msgCount = messagesData?.messages?.length ?? 0;
  const handle = session?.profile?.handle ?? "";
  const fullUrl = `https://${shortlinkurl}/${handle}`;

  return (
    <Box maw={1080}>
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
          {/* ── Header row ── */}
          <Group
            justify="space-between"
            align="flex-end"
            mb="lg"
            wrap="wrap"
            gap="sm"
          >
            <Box>
              <Title order={1} style={{ letterSpacing: "-0.03em" }}>
                Messages
              </Title>
              {!messagesLoading && (
                <Text ff="monospace" fz={11} c="dimmed" mt={6} style={{ letterSpacing: "0.05em" }}>
                  {msgCount > 0 ? (
                    <><span style={{ color: "var(--nf-sunshine)" }}>●</span> {msgCount} new</>
                  ) : "no messages"}
                </Text>
              )}
            </Box>
          </Group>

          {/* ── Gradient inbox link hero card ── */}
          <Paper
            mb="md"
            p="lg"
            style={{
              borderRadius: 18,
              background: "var(--nf-grad-mark)",
              position: "relative",
              overflow: "hidden",
              boxShadow: "0 18px 40px -18px rgba(107,63,212,0.6)",
            }}
          >
            {/* WinkMark watermark */}
            <Box
              style={{
                position: "absolute",
                right: -24,
                top: -24,
                opacity: 0.1,
                pointerEvents: "none",
              }}
            >
              <WinkMark size={160} sparkle={false} aria-hidden />
            </Box>
            <Group
              align="center"
              gap="md"
              wrap="wrap"
              style={{ position: "relative" }}
            >
              <Box style={{ flex: 1, minWidth: 200 }}>
                <Text
                  ff="monospace"
                  size="xs"
                  c="white"
                  opacity={0.85}
                  fw={700}
                  style={{ letterSpacing: "0.1em", textTransform: "uppercase" }}
                >
                  your inbox link · publicly accessible
                </Text>
                <Text
                  ff="monospace"
                  fw={700}
                  c="white"
                  fz={17}
                  mt={4}
                >
                  {shortlinkurl}/{handle}
                </Text>
              </Box>
              <Group gap="xs" wrap="wrap">
                <CopyButton value={fullUrl}>
                  {({ copied, copy }) => (
                    <Tooltip label={copied ? "Copied!" : "Copy link"} withArrow>
                      <Button
                        onClick={copy}
                        size="sm"
                        radius="xl"
                        variant="transparent"
                        leftSection={<IconClipboard size={14} />}
                        style={{ background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.2)", "--button-color": "var(--mantine-white)" } as React.CSSProperties}
                      >
                        {copied ? "Copied!" : "Copy"}
                      </Button>
                    </Tooltip>
                  )}
                </CopyButton>
                {(() => {
                  const sharePayload = {
                    title: "Send me anonymous messages on Navyfragen!",
                    text: `Send ${session.profile?.displayName} anonymous messages!`,
                    url: fullUrl,
                  };
                  return <ShareButton shareData={sharePayload} />;
                })()}
              </Group>
            </Group>
          </Paper>

          {messagesLoading ? (
            <Center>
              <Loader size="lg" />
            </Center>
          ) : msgCount > 0 ? (
            <>
              {/* ── Two-column: Preferences + Image theme ── */}
              <SimpleGrid
                cols={{ base: 1, md: 2 }}
                spacing="md"
                mb="lg"
                style={{ alignItems: "start" }}
              >
                {/* Posting preferences accordion */}
                <Paper
                  withBorder
                  p={0}
                  style={{
                    borderRadius: 16,
                    overflow: "hidden",
                    background: surfaceBg(isDark),
                  }}
                >
                  <Box
                    style={{
                      cursor: "pointer",
                      padding: "14px 20px",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      userSelect: "none",
                    }}
                    onClick={() => setPostingPrefsOpen((o) => !o)}
                  >
                    <Text fw={700} fz={15}>
                      Posting preferences
                    </Text>
                    <span
                      style={{ display: "flex", alignItems: "center", gap: 6 }}
                    >
                      <Text ff="monospace" size="xs" c="dimmed">
                        {
                          [
                            appendProfileLink,
                            useGradients,
                            includeQuestionAsImage,
                            confirmBeforeDelete,
                            autoScrollToMessages,
                          ].filter(Boolean).length
                        }{" "}
                        of 5 on
                      </Text>
                      <IconChevronDown
                        size={16}
                        style={{
                          transition: "transform 200ms ease",
                          transform: postingPrefsOpen
                            ? "rotate(180deg)"
                            : "rotate(0deg)",
                          color: "var(--mantine-color-dimmed)",
                        }}
                      />
                    </span>
                  </Box>
                  <Collapse in={postingPrefsOpen}>
                    <Box
                      px="md"
                      pb="sm"
                      style={{
                        borderTop:
                          "1px solid var(--mantine-color-default-border)",
                      }}
                    >
                      {[
                        {
                          checked: appendProfileLink,
                          onChange: setAppendProfileLink,
                          label: "Auto-append inbox link",
                          sub: "Appends your link to every post. Reduces character budget.",
                        },
                        {
                          checked: useGradients,
                          onChange: setUseGradients,
                          label: "Gradient backgrounds",
                          sub: "Pretty for screenshots. Turn off for higher contrast.",
                        },
                        {
                          checked: includeQuestionAsImage,
                          onChange: setIncludeQuestionAsImage,
                          label: "Question as image",
                          sub: "Generates a shareable image with auto alt text.",
                        },
                        {
                          checked: confirmBeforeDelete,
                          onChange: setConfirmBeforeDelete,
                          label: "Confirm before deleting",
                          sub: "Leave off if you want to bulk-delete messages.",
                        },
                        {
                          checked: autoScrollToMessages,
                          onChange: setAutoScrollToMessages,
                          label: "Auto-scroll to messages",
                          sub: "Scrolls new messages into view when they load.",
                        },
                      ].map(({ checked, onChange, label, sub }) => (
                        <Box
                          key={label}
                          py="xs"
                          style={{
                            borderBottom:
                              "1px solid var(--mantine-color-default-border)",
                          }}
                        >
                          <Switch
                            checked={!!checked}
                            onChange={(e) => onChange(e.currentTarget.checked)}
                            label={
                              <Box>
                                <Text fw={600} size="sm">
                                  {label}
                                </Text>
                                <Text size="xs" c="dimmed" mt={2}>
                                  {sub}
                                </Text>
                              </Box>
                            }
                          />
                        </Box>
                      ))}
                    </Box>
                  </Collapse>
                </Paper>

                {/* Image theme visual picker */}
                <Paper
                  withBorder
                  p={0}
                  style={{
                    borderRadius: 16,
                    overflow: "hidden",
                    background: surfaceBg(isDark),
                  }}
                >
                  <Box
                    style={{
                      cursor: "pointer",
                      padding: "14px 20px",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      userSelect: "none",
                    }}
                    onClick={() => setImageThemeOpen((o) => !o)}
                  >
                    <Text fw={700} fz={15}>
                      Image theme
                    </Text>
                    <span
                      style={{ display: "flex", alignItems: "center", gap: 6 }}
                    >
                      <Text ff="monospace" size="xs" c="dimmed">
                        {
                          themes[
                            (settingsLoading
                              ? "default"
                              : userSettings?.imageTheme ||
                                "default") as keyof typeof themes
                          ]
                        }
                      </Text>
                      <IconChevronDown
                        size={16}
                        style={{
                          transition: "transform 200ms ease",
                          transform: imageThemeOpen
                            ? "rotate(180deg)"
                            : "rotate(0deg)",
                          color: "var(--mantine-color-dimmed)",
                        }}
                      />
                    </span>
                  </Box>
                  <Collapse in={imageThemeOpen}>
                    <Box
                      px="md"
                      pb="md"
                      style={{
                        borderTop:
                          "1px solid var(--mantine-color-default-border)",
                      }}
                    >
                      <Group grow gap="sm" mt="sm">
                        {Object.entries(themes).map(([value, label]) => (
                          <ThemeCard
                            key={value}
                            value={value}
                            label={label as string}
                            selected={
                              settingsLoading
                                ? value === "default"
                                : (userSettings?.imageTheme || "default") ===
                                  value
                            }
                            onClick={() => {
                              if (
                                !settingsLoading &&
                                !updateSettings.isPending
                              ) {
                                updateSettings.mutate({
                                  imageTheme: value,
                                  pdsSyncEnabled: Boolean(
                                    userSettings?.pdsSyncEnabled,
                                  ),
                                });
                              }
                            }}
                          />
                        ))}
                      </Group>

                      <Box
                        mt="md"
                        pt="md"
                        style={{
                          borderTop:
                            "1px solid var(--mantine-color-default-border)",
                        }}
                      >
                        <Text
                          ff="monospace"
                          fw={700}
                          tt="uppercase"
                          c="dimmed"
                          mb="xs"
                          style={{ fontSize: 10, letterSpacing: "0.1em" }}
                        >
                          Keyboard Shortcuts
                        </Text>
                        <Stack gap={2}>
                          {[
                            { label: "Focus / cycle cards", hint: "Alt+R" },
                            { label: "Navigate cards", hint: "↑ / ↓" },
                            { label: "Close expanded card", hint: "Esc" },
                          ].map(({ label, hint }) => (
                            <Box
                              key={label}
                              style={{ display: "flex", justifyContent: "space-between", padding: "3px 0" }}
                            >
                              <Text fz={12}>{label}</Text>
                              <Text ff="monospace" fz={11} c="dimmed">
                                {hint.replace("Alt", "Alt/⌘")}
                              </Text>
                            </Box>
                          ))}
                        </Stack>
                      </Box>
                    </Box>
                  </Collapse>
                </Paper>
              </SimpleGrid>

              {/* ── Question cards grid ── */}
              <div ref={messagesTopRef} />
              <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
                {messagesData?.messages.map((msg: Message, index: number) => {
                  const isExpanded = respondingTid === msg.tid;
                  const isFocused = focusedCardIndex === index;

                  return (
                    <Paper
                      id={`message-card-${msg.tid}`}
                      ref={(el) => {
                        messageCardRefs.current[index] = el;
                      }}
                      key={msg.tid}
                      tabIndex={0}
                      radius="lg"
                      onFocus={() => setFocusedCardIndex(index)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          if (isExpanded) {
                            setRespondingTid(null);
                          } else {
                            handlePrepareResponse(msg.tid);
                          }
                        }
                      }}
                      style={{
                        borderRadius: 18,
                        background: useGradients ? "var(--nf-grad-dark)" : surfaceBg(isDark),
                        border: isFocused
                          ? "2px solid var(--nf-purple)"
                          : "2px solid rgba(255,255,255,0.06)",
                        boxShadow: isFocused
                          ? "0 18px 40px -16px rgba(0,0,0,0.4), 0 0 0 3px rgba(139,92,246,0.35)"
                          : "0 18px 40px -16px rgba(0,0,0,0.4)",
                        padding: "8px 20px 20px",
                        transition:
                          "border-color 0.15s ease, box-shadow 0.15s ease",
                        cursor: "pointer",
                        display: "flex",
                        flexDirection: "column",
                      }}
                      onClick={() => {
                        if (isExpanded) {
                          setRespondingTid(null);
                        } else {
                          handlePrepareResponse(msg.tid);
                        }
                      }}
                    >
                      <Stack gap="sm" style={{ flex: 1 }}>
                        {/* Timestamp row */}
                        <Group justify="space-between" align="center">
                          <Group gap={8} align="center">
                            <Text
                              ff="monospace"
                              fz={10}
                              c="white"
                              opacity={0.8}
                              style={{ letterSpacing: "0.08em", textTransform: "uppercase" }}
                            >
                              {formatTimestamp(msg.createdAt)}
                            </Text>
                          </Group>
                          <ActionIcon
                            size="lg"
                            className="nf-delete-btn"
                            aria-label="Delete message"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteRequest(msg.tid);
                            }}
                            variant="transparent"
                            radius="md"
                            loading={deletingTid === msg.tid}
                            style={{
                              color: "rgba(253,248,255,0.5)",
                              transition:
                                "color 150ms ease, background 150ms ease",
                            }}
                          >
                            <IconTrash size={18} />
                          </ActionIcon>
                        </Group>

                        {/* Message text */}
                        <Box
                          style={{
                            flex: 1,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <Text
                            c="white"
                            fw={600}
                            style={
                              {
                                fontSize: 20,
                                lineHeight: 1.35,
                                wordBreak: "break-word",
                                whiteSpace: "pre-wrap",
                                textAlign: "center",
                                textWrap: "balance",
                                width: "100%",
                              } as React.CSSProperties
                            }
                          >
                            {msg.message}
                          </Text>
                        </Box>

                        {/* Action area */}
                        {isExpanded ? (
                          <Box
                            onClick={(e) => e.stopPropagation()}
                            style={{
                              marginTop: 4,
                              background: "#fff",
                              borderRadius: 12,
                              padding: 12,
                              border: "1.5px solid #5B7BFF",
                            }}
                          >
                            <Textarea
                              ref={textareaRef}
                              value={responseText}
                              maxLength={characterLimit}
                              onChange={(e) => setResponseText(e.target.value)}
                              autosize
                              minRows={2}
                              maxRows={4}
                              aria-label="Your response"
                              onKeyDown={(e) => {
                                e.stopPropagation();
                                if (e.key === "Escape") {
                                  e.preventDefault();
                                  setRespondingTid(null);
                                  messageCardRefs.current[index]?.focus();
                                } else if (e.key === "Enter" && !e.shiftKey) {
                                  e.preventDefault();
                                  handleSendResponse(msg);
                                }
                              }}
                              placeholder="write your reply…"
                              styles={replyTextareaStyles}
                            />
                            <Group
                              justify="space-between"
                              align="center"
                              mt={8}
                            >
                              <Group gap={8} align="center">
                                <CharRing
                                  count={responseText.length}
                                  limit={characterLimit}
                                />
                                <Text ff="monospace" size="xs" c="dimmed">
                                  {responseText.length}/{characterLimit}
                                </Text>
                              </Group>
                              <Button
                                size="xs"
                                onClick={() => handleSendResponse(msg)}
                                loading={respondLoading}
                                variant="gradient"
                                gradient={{
                                  from: "royal",
                                  to: "purple",
                                  deg: 135,
                                }}
                                leftSection={<IconSend2 size={12} />}
                              >
                                Reply
                              </Button>
                            </Group>
                          </Box>
                        ) : (
                          <Box mt={4} onClick={(e) => e.stopPropagation()}>
                            <Button
                              onClick={() => handlePrepareResponse(msg.tid)}
                              fullWidth
                              radius="xl"
                              color="sunshine"
                              variant="filled"
                              fw={700}
                              style={{ color: "var(--nf-midnight)" }}
                            >
                              ↩ Reply
                            </Button>
                          </Box>
                        )}
                      </Stack>
                    </Paper>
                  );
                })}
              </SimpleGrid>
            </>
          ) : (
            <Alert color="royal" title="No messages">
              <Text fz="sm" mb="sm">
                You don&apos;t have any messages yet. Share your profile link to
                receive anonymous questions.
              </Text>
              <Button
                onClick={handleAddExampleMessages}
                loading={examplesLoading}
                size="xs"
                radius="xl"
                color="sunshine"
                variant="filled"
                style={{ color: "var(--nf-midnight)", fontWeight: 700 }}
              >
                Add example messages
              </Button>
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
    </Box>
  );
}
