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
} from "@mantine/core";
import { useLocalStorage } from "@mantine/hooks";
import { IconClipboard, IconSend2, IconTrash } from "@tabler/icons-react";
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



const shortlinkurl =
  import.meta.env.VITE_SHORTLINK_URL || "localhost:5173/profile";

const MAX_BSKY_POST_LENGTH = 280;
const GENERAL_BUFFER = 3;

interface PageAlert {
  title: string;
  message: React.ReactNode;
  color: "red" | "green" | "blue" | "yellow";
}

function formatTimestamp(dateStr: string): string {
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
  const color = danger ? "#FACC15" : "#3B5BFF";
  return (
    <svg width={22} height={22} viewBox="0 0 22 22" style={{ flexShrink: 0 }}>
      <circle
        cx={11}
        cy={11}
        r={r}
        fill="none"
        stroke="rgba(253,248,255,0.15)"
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
            background:
              "linear-gradient(135deg, #1E1B4B 0%, #3B2E78 55%, #6B3FD4 100%)",
            height: "100%",
            borderRadius: 5,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 10,
          }}
        >
          <div
            style={{
              background: "#fff",
              borderRadius: 8,
              padding: "7px 12px",
              width: "80%",
              boxShadow: "0 3px 10px rgba(0,0,0,0.3)",
            }}
          >
            <div
              style={{
                height: 4,
                background: "#ccc",
                borderRadius: 3,
                marginBottom: 4,
              }}
            />
            <div
              style={{
                height: 4,
                background: "#ccc",
                borderRadius: 3,
                width: "65%",
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
          background: "#f7f9f9",
          height: "100%",
          borderRadius: 5,
          display: "flex",
          alignItems: "center",
          padding: 8,
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
  const messageCardRefs = useRef<(HTMLDivElement | null)[]>([]);
  const computedColorScheme = useComputedColorScheme("light", {
    getInitialValueInEffect: true,
  });

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
  const messagesTopRef = useRef<HTMLDivElement>(null);
  const prevMsgCountRef = useRef<number>(0);
  const [deleteModalOpened, setDeleteModalOpened] = useState<boolean>(false);
  const [messageIdToDelete, setMessageIdToDelete] = useState<string | null>(
    null,
  );
  const [pageAlert, setPageAlert] = useState<PageAlert | null>(null);
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
      setPageAlert({
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
      onSuccess: () => refetchMessages(),
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

  const performDelete = (tid: string, fromModal = false) => {
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
    if (messageIdToDelete) performDelete(messageIdToDelete, true);
  };

  const handlePrepareResponse = (tid: string) => {
    setRespondingTid(tid);
    setResponseText("");
    const idx = messagesData?.messages.findIndex((m) => m.tid === tid);
    if (idx !== undefined && idx !== -1) setFocusedCardIndex(idx);
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
          setPageAlert({
            title: "Response Sent!",
            message: successMsg,
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
    if (count > prev && prev > 0 && messages?.[0]) {
      const newestCard = document.getElementById(`message-card-${messages[0].tid}`);
      const target = newestCard ?? messagesTopRef.current;
      if (target) {
        const { top, bottom } = target.getBoundingClientRect();
        if (top >= window.innerHeight || bottom <= 0) {
          (messagesTopRef.current ?? target).scrollIntoView({ behavior: "smooth", block: "start" });
        }
      }
    }
  }, [messagesData]);

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
              <Title
                order={1}
                style={{
                  fontFamily: "Inter",
                  fontWeight: 800,
                  fontSize: 32,
                  letterSpacing: "-0.03em",
                }}
              >
                Messages
              </Title>
              {!messagesLoading && (
                <div
                  style={{
                    display: "flex",
                    gap: 12,
                    marginTop: 6,
                    fontFamily: "JetBrains Mono, monospace",
                    fontSize: 11,
                    color: "var(--mantine-color-dimmed)",
                    letterSpacing: "0.05em",
                  }}
                >
                  {msgCount > 0 ? (
                    <span>
                      <span style={{ color: "#FACC15" }}>●</span> {msgCount} new
                    </span>
                  ) : (
                    <span>no messages</span>
                  )}
                </div>
              )}
            </Box>
          </Group>

          {/* ── Gradient inbox link hero card ── */}
          <Paper
            mb="md"
            p="lg"
            style={{
              borderRadius: 18,
              background:
                "linear-gradient(135deg, #3349E0 0%, #6B3FD4 55%, #4F1FA6 100%)",
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
                  style={{
                    letterSpacing: "0.1em",
                    textTransform: "uppercase",
                    opacity: 0.85,
                    fontWeight: 700,
                    color: "#FDF8FF",
                  }}
                >
                  your inbox link · publicly accessible
                </Text>
                <Text
                  ff="monospace"
                  fw={700}
                  style={{ fontSize: 17, color: "#FDF8FF", marginTop: 4 }}
                >
                  {shortlinkurl}/{handle}
                </Text>
              </Box>
              <Group gap="xs" wrap="wrap">
                <CopyButton value={fullUrl}>
                  {({ copied, copy }) => (
                    <Tooltip label={copied ? "Copied!" : "Copy link"} withArrow>
                      <button
                        onClick={copy}
                        style={{
                          background: "rgba(255,255,255,0.15)",
                          border: "1px solid rgba(255,255,255,0.2)",
                          color: "#FDF8FF",
                          padding: "8px 14px",
                          borderRadius: 999,
                          fontFamily: "Inter",
                          fontWeight: 600,
                          fontSize: 13,
                          cursor: "pointer",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6,
                        }}
                      >
                        <IconClipboard size={14} /> {copied ? "Copied" : "Copy"}
                      </button>
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
                <button
                  onClick={handleAddExampleMessages}
                  disabled={examplesLoading}
                  style={{
                    background: "#FACC15",
                    border: "none",
                    color: "#1E1B4B",
                    padding: "8px 14px",
                    borderRadius: 999,
                    fontFamily: "Inter",
                    fontWeight: 700,
                    fontSize: 13,
                    cursor: "pointer",
                    opacity: examplesLoading ? 0.7 : 1,
                  }}
                >
                  {examplesLoading ? "Adding…" : "Add Examples"}
                </button>
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
              <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md" mb="lg">
                {/* Posting preferences accordion */}
                <Paper
                  withBorder
                  p={0}
                  style={{
                    borderRadius: 16,
                    overflow: "hidden",
                    background:
                      computedColorScheme === "dark"
                        ? "rgba(255,255,255,0.06)"
                        : "#F2EBFF",
                  }}
                >
                  <details open>
                    <summary
                      style={{
                        listStyle: "none",
                        cursor: "pointer",
                        padding: "14px 20px",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        fontFamily: "Inter",
                        fontWeight: 700,
                        fontSize: 15,
                      }}
                    >
                      <Text
                        component="span"
                        style={{
                          fontFamily: "Inter",
                          fontWeight: 700,
                          fontSize: 15,
                        }}
                      >
                        Posting preferences
                      </Text>
                      <Text component="span" ff="monospace" size="xs" c="dimmed">
                        {
                          [
                            appendProfileLink,
                            useGradients,
                            includeQuestionAsImage,
                            confirmBeforeDelete,
                          ].filter(Boolean).length
                        }{" "}
                        of 4 on
                      </Text>
                    </summary>
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
                  </details>
                </Paper>

                {/* Image theme visual picker */}
                <Paper
                  withBorder
                  p={0}
                  style={{
                    borderRadius: 16,
                    overflow: "hidden",
                    background:
                      computedColorScheme === "dark"
                        ? "rgba(255,255,255,0.06)"
                        : "#F2EBFF",
                  }}
                >
                  <details open>
                    <summary
                      style={{
                        listStyle: "none",
                        cursor: "pointer",
                        padding: "14px 20px",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        fontFamily: "Inter",
                        fontWeight: 700,
                        fontSize: 15,
                      }}
                    >
                      <Text
                        component="span"
                        style={{
                          fontFamily: "Inter",
                          fontWeight: 700,
                          fontSize: 15,
                        }}
                      >
                        Image theme &amp; shortcuts
                      </Text>
                    </summary>
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
                                : (userSettings?.imageTheme || "default") === value
                            }
                            onClick={() => {
                              if (!settingsLoading && !updateSettings.isPending) {
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
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                padding: "3px 0",
                              }}
                            >
                              <Text style={{ fontFamily: "Inter", fontSize: 12 }}>
                                {label}
                              </Text>
                              <Text
                                style={{
                                  fontFamily: "JetBrains Mono, monospace",
                                  fontSize: 11,
                                  color: "var(--mantine-color-dimmed)",
                                }}
                              >
                                {hint.replace("Alt", "Alt/⌘")}
                              </Text>
                            </Box>
                          ))}
                        </Stack>
                      </Box>
                    </Box>
                  </details>
                </Paper>
              </SimpleGrid>

              {/* ── Question cards grid ── */}
              <div ref={messagesTopRef} />
              <SimpleGrid
                cols={{ base: 1, sm: 2 }}
                spacing="md"
                style={{ alignItems: "start" }}
              >
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
                        background: useGradients
                          ? "linear-gradient(135deg, #1E1B4B 0%, #3B2E78 50%, #6B3FD4 100%)"
                          : "var(--mantine-color-midnight-9)",
                        border: isFocused
                          ? "2px solid rgba(255,255,255,0.5)"
                          : "2px solid rgba(255,255,255,0.06)",
                        boxShadow: "0 18px 40px -16px rgba(0,0,0,0.4)",
                        padding: 22,
                        transition: "border-color 0.15s ease",
                        cursor: "pointer",
                      }}
                      onClick={() => {
                        if (isExpanded) {
                          setRespondingTid(null);
                        } else {
                          handlePrepareResponse(msg.tid);
                        }
                      }}
                    >
                      <Stack gap="sm">
                        {/* Timestamp row */}
                        <Group justify="space-between" align="center">
                          <Group gap={8} align="center">
                            <Text
                              style={{
                                fontFamily: "JetBrains Mono, monospace",
                                fontSize: 10,
                                letterSpacing: "0.08em",
                                textTransform: "uppercase",
                                color: "rgba(253,248,255,0.8)",
                              }}
                            >
                              {formatTimestamp(msg.createdAt)}
                            </Text>
                          </Group>
                          <ActionIcon
                            size="lg"
                            className="nf-delete-btn"
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
                            } as React.CSSProperties
                          }
                        >
                          {msg.message}
                        </Text>

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
                              styles={{
                                input: {
                                  background: "transparent",
                                  color: "#1E1B4B",
                                  border: "none",
                                  padding: 0,
                                },
                              }}
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
                                <Text
                                  ff="monospace"
                                  size="xs"
                                  style={{ color: "#5B5680" }}
                                >
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
                            <button
                              onClick={() => handlePrepareResponse(msg.tid)}
                              style={{
                                width: "100%",
                                background: "#FACC15",
                                border: "none",
                                color: "#1E1B4B",
                                padding: "8px 0",
                                borderRadius: 999,
                                fontFamily: "Inter",
                                fontWeight: 700,
                                fontSize: 13,
                                cursor: "pointer",
                                display: "inline-flex",
                                alignItems: "center",
                                justifyContent: "center",
                                gap: 6,
                              }}
                            >
                              ↩ Reply
                            </button>
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
              You don&apos;t have any messages yet. Share your profile link to
              receive anonymous questions.
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
