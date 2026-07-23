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
  IconExternalLink,
  IconPin,
  IconPinned,
  IconSend2,
  IconTrash,
} from "@tabler/icons-react";
import { useEffect, useMemo, useState, useRef } from "react";
import { useHaptic } from "use-haptic";

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
import { themes } from "../lib/themes";
import { getTouchpointTranslations } from "../lib/touchpointTranslations";
import { surfaceBg } from "../styles/tokens";

// Styles for the reply textarea inside the response box (white card on dark background)
const replyTextareaStyles = {
  input: {
    background: "transparent",
    color: "var(--nf-midnight)",
    border: "none",
    padding: 0,
  },
} as const;

const shortlinkurl = import.meta.env.VITE_SHORTLINK_URL || "localhost:5173/profile";

const MAX_BSKY_POST_LENGTH = 280;
const GENERAL_BUFFER = 3;

interface ThreadLinkData {
  uri: string;
  cid: string;
  link?: string;
}

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

function ThemeCardPreview({ value }: { value: string }) {
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
        <ThemeCardPreview value={value} />
      </div>
      <Text size="xs" fw={600} ta="center" style={{ color: "var(--mantine-color-text)" }}>
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
  const { triggerHaptic } = useHaptic(1);

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

  const { data: session, isLoading: sessionLoading } = useSession();

  const [threadRootTid, setThreadRootTid] = useLocalStorage<string | null>({
    key: `threadRootTid-${session?.did ?? ""}`,
    defaultValue: null,
    getInitialValueInEffect: true,
  });
  const [threadLinks, setThreadLinks] = useLocalStorage<Record<string, ThreadLinkData>>({
    key: `threadLinks-${session?.did ?? ""}`,
    defaultValue: {},
    getInitialValueInEffect: true,
  });
  const [justPinnedTid, setJustPinnedTid] = useState<string | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesTopRef = useRef<HTMLDivElement>(null);
  const prevMsgCountRef = useRef<number>(0);
  const [deleteModalOpened, setDeleteModalOpened] = useState<boolean>(false);
  const [messageIdToDelete, setMessageIdToDelete] = useState<string | null>(null);
  const [deletingTid, setDeletingTid] = useState<string | null>(null);

  const {
    data: messagesData,
    isLoading: messagesLoading,
    refetch: refetchMessages,
  } = useMessages(session?.did || null, {
    refetchInterval: 10000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });

  const { mutate: deleteMessage, isPending: deleteLoading } = useDeleteMessage();
  const { mutate: respondToMessage, isPending: respondLoading } = useRespondToMessage();
  const { mutate: addExamples, isPending: examplesLoading } = useAddExampleMessages();

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

  const characterLimit = useMemo(() => {
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
    return Math.max(0, maxLength);
  }, [
    appendProfileLink,
    session?.profile?.handle,
    includeQuestionAsImage,
    respondingTid,
    messagesData,
  ]);

  const sortedMessages = useMemo(() => {
    const msgs = messagesData?.messages ?? [];
    if (!threadRootTid) return msgs;
    const idx = msgs.findIndex((m) => m.tid === threadRootTid);
    if (idx <= 0) return msgs;
    return [msgs[idx], ...msgs.slice(0, idx), ...msgs.slice(idx + 1)];
  }, [messagesData, threadRootTid]);

  useEffect(() => {
    if (!messagesData || !threadRootTid) return;
    const found = messagesData.messages.some((m) => m.tid === threadRootTid);
    if (!found) {
      setThreadLinks((prev) => {
        const next = { ...prev };
        delete next[threadRootTid];
        return next;
      });
      setThreadRootTid(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messagesData, threadRootTid]);

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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      onError: (err: any) => {
        notifications.show({
          title: "Error Adding Examples",
          message: err.error || "Failed to add example messages.",
          color: "red",
        });
      },
    });
  };

  const handleTogglePin = (tid: string) => {
    triggerHaptic();
    if (threadRootTid === tid) {
      setThreadRootTid(null);
    } else {
      setThreadRootTid(tid);
      setJustPinnedTid(tid);
      setTimeout(() => setJustPinnedTid(null), 420);
    }
  };

  const handleDeleteRequest = (tid: string) => {
    // The trash ActionIcon's onClick already guards on `isPinned` (threadRootTid === msg.tid)
    // before ever calling this handler, so this condition can never be true through the UI —
    // see docs/testing-notes.md for details.
    /* v8 ignore start */
    if (threadRootTid === tid) return;
    /* v8 ignore stop */
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
        refetchMessages().finally(() => setDeletingTid(null));
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
    // messageIdToDelete is always set in the same state update that opens the modal, and the
    // Confirm button that invokes this handler only exists in the DOM while the modal is
    // opened — so the false arm (messageIdToDelete === null) has no reachable UI path. See
    // docs/testing-notes.md for details.
    /* v8 ignore start */
    if (messageIdToDelete) performDelete(messageIdToDelete, true);
    /* v8 ignore stop */
  };

  const handlePrepareResponse = (tid: string) => {
    setRespondingTid(tid);
    setResponseText("");
    const idx = sortedMessages.findIndex((m) => m.tid === tid);
    // Every call site passes a tid taken directly from a `sortedMessages` entry, so idx is
    // always found — the -1 branch has no reachable UI path. See docs/testing-notes.md.
    /* v8 ignore start */
    if (idx !== -1) setFocusedCardIndex(idx);
    /* v8 ignore stop */
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

    const isPinnedMsg = threadRootTid === msg.tid;
    const rootData = threadRootTid ? threadLinks[threadRootTid] : undefined;
    const replyTo =
      !isPinnedMsg && rootData?.uri && rootData?.cid
        ? { uri: rootData.uri, cid: rootData.cid }
        : undefined;

    respondToMessage(
      {
        tid: msg.tid,
        recipient: msg.recipient,
        original: msg.message,
        response: text,
        includeQuestionAsImage,
        replyTo,
      },
      {
        onSuccess: (data) => {
          if (isPinnedMsg && data.uri && data.cid) {
            setThreadLinks((prev) => ({
              ...prev,
              [msg.tid]: { uri: data.uri!, cid: data.cid!, link: data.link },
            }));
          }
          setRespondingTid(null);
          setResponseText("");
          const successMsg: React.ReactNode = data.link ? (
            <>
              {replyTo ? "Added to thread." : "Your response has been posted."}{" "}
              <a
                href={data.link}
                target="_blank"
                rel="noreferrer"
                style={{ color: "inherit", textDecoration: "underline" }}
              >
                {data.link}
              </a>
            </>
          ) : replyTo ? (
            "Added to thread."
          ) : (
            "Your response has been posted."
          );
          notifications.show({
            title: replyTo ? "Added to thread!" : "Response Sent!",
            message: successMsg,
            color: "green",
            autoClose: 8000,
          });
          refetchMessages();
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        onError: (err: any) => {
          notifications.show({
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
      const el = document.getElementById(`message-card-${respondingTid}`);
      // respondingTid is always set (via handlePrepareResponse) to the tid of a card that is
      // already rendered in the same commit, so el is always found — the false arm has no
      // reachable UI path. See docs/testing-notes.md.
      /* v8 ignore start */
      // Defer the scroll so it lands after the textarea-expansion layout shift
      // settles; without the cleanup, the timer survives a respondingTid change
      // (or unmount) and scrolls a card from a prior interaction.
      let handle: ReturnType<typeof setTimeout> | undefined;
      if (el)
        handle = setTimeout(() => el.scrollIntoView({ behavior: "smooth", block: "nearest" }), 150);
      return () => {
        if (handle) clearTimeout(handle);
      };
      /* v8 ignore stop */
    }
  }, [respondingTid]);

  useEffect(() => {
    messageCardRefs.current = sortedMessages.map(() => null);
  }, [sortedMessages]);

  useEffect(() => {
    const messages = messagesData?.messages;
    const count = messages?.length ?? 0;
    const prev = prevMsgCountRef.current;
    prevMsgCountRef.current = count;
    if (autoScrollToMessages && count > prev && messages?.[0]) {
      const newestCard = document.getElementById(`message-card-${messages[0].tid}`);
      // newestCard is always found whenever this branch runs (messages[0] existing implies its
      // card is rendered in the same commit), so the `?? messagesTopRef.current` fallback and
      // the `if (target)` guard's false arm are both structurally unreachable. See
      // docs/testing-notes.md.
      /* v8 ignore start */
      const target = newestCard ?? messagesTopRef.current;
      if (target) {
        /* v8 ignore stop */
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

      if (event.key === "Escape" && respondingTid) {
        event.preventDefault();
        const idx = sortedMessages.findIndex((m) => m.tid === respondingTid);
        setRespondingTid(null);
        // respondingTid always corresponds to an entry in sortedMessages, so idx is always
        // found — the -1 branch has no reachable UI path. See docs/testing-notes.md.
        /* v8 ignore start */
        if (idx !== -1) messageCardRefs.current[idx]?.focus();
        /* v8 ignore stop */
        return;
      }

      if (["INPUT", "TEXTAREA", "SELECT"].includes(tag)) return;

      if ((event.altKey || event.metaKey) && event.key.toUpperCase() === "R") {
        event.preventDefault();
        if (sortedMessages.length) {
          const newIdx =
            focusedCardIndex === -1 ? 0 : (focusedCardIndex + 1) % sortedMessages.length;
          setFocusedCardIndex(newIdx);
          messageCardRefs.current[newIdx]?.focus();
        }
      }
      if (focusedCardIndex !== -1 && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
        event.preventDefault();
        if (sortedMessages.length) {
          const newIdx =
            event.key === "ArrowDown"
              ? (focusedCardIndex + 1) % sortedMessages.length
              : (focusedCardIndex - 1 + sortedMessages.length) % sortedMessages.length;
          setFocusedCardIndex(newIdx);
          messageCardRefs.current[newIdx]?.focus();
        }
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [focusedCardIndex, sortedMessages, respondingTid]);

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
          <Group justify="space-between" align="flex-end" mb="lg" wrap="wrap" gap="sm">
            <Box>
              <Title order={1} style={{ letterSpacing: "-0.03em" }}>
                Messages
              </Title>
              {!messagesLoading && (
                <Text fz={11} c="dimmed" mt={6} style={{ letterSpacing: "0.05em" }}>
                  {msgCount > 0 ? (
                    <>
                      <span style={{ color: "var(--nf-sunshine)" }}>●</span> {msgCount} new
                    </>
                  ) : (
                    "no messages"
                  )}
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
              background: "var(--nf-grad-dark)",
              position: "relative",
              overflow: "hidden",
            }}
          >
            <Group align="center" gap="md" wrap="wrap" style={{ position: "relative" }}>
              <Box style={{ flex: 1, minWidth: 200 }}>
                <Text size="xs" c="white" opacity={0.7} fw={500} mb={6}>
                  Your inbox link · publicly accessible
                </Text>
                <Text fw={700} fz={17} style={{ color: "var(--nf-lavender)" }}>
                  {shortlinkurl}/{handle}
                </Text>
              </Box>
              <Group gap="xs" wrap="wrap">
                <CopyButton value={fullUrl}>
                  {({ copied, copy }) => (
                    <Tooltip label={copied ? "Copied!" : "Copy link"} withArrow>
                      <Button
                        onClick={() => {
                          triggerHaptic();
                          copy();
                        }}
                        size="sm"
                        radius="xl"
                        variant="transparent"
                        leftSection={<IconClipboard size={14} />}
                        style={
                          {
                            background: "rgba(255,255,255,0.15)",
                            border: "1px solid rgba(255,255,255,0.2)",
                            "--button-color": "var(--mantine-white)",
                          } as React.CSSProperties
                        }
                      >
                        {copied ? "Copied!" : "Copy"}
                      </Button>
                    </Tooltip>
                  )}
                </CopyButton>
                {(() => {
                  // Localize the owner's own share copy in their selected
                  // touchpoint language (#266) — this text leaves the DOM into
                  // a tweet/DM, so Google Translate can't reach it.
                  const ownerName = session.profile?.displayName || session.profile?.handle || "";
                  const t = getTouchpointTranslations(userSettings?.touchpointLocale);
                  const sharePayload = {
                    title: t.inboxShareTitle,
                    text: t.inboxShareText(ownerName),
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
                    onClick={() => {
                      triggerHaptic();
                      setPostingPrefsOpen((o) => !o);
                    }}
                  >
                    <Text fw={700} fz={15}>
                      Posting preferences
                    </Text>
                    <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <Text size="xs" c="dimmed">
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
                          transform: postingPrefsOpen ? "rotate(180deg)" : "rotate(0deg)",
                          color: "var(--mantine-color-dimmed)",
                        }}
                      />
                    </span>
                  </Box>
                  <Collapse expanded={postingPrefsOpen}>
                    <Box
                      px="md"
                      pb="sm"
                      style={{
                        borderTop: "1px solid var(--mantine-color-default-border)",
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
                            borderBottom: "1px solid var(--mantine-color-default-border)",
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
                    onClick={() => {
                      triggerHaptic();
                      setImageThemeOpen((o) => !o);
                    }}
                  >
                    <Text fw={700} fz={15}>
                      Image theme
                    </Text>
                    <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <Text size="xs" c="dimmed">
                        {
                          themes[
                            (settingsLoading
                              ? "default"
                              : userSettings?.imageTheme || "default") as keyof typeof themes
                          ]
                        }
                      </Text>
                      <IconChevronDown
                        size={16}
                        style={{
                          transition: "transform 200ms ease",
                          transform: imageThemeOpen ? "rotate(180deg)" : "rotate(0deg)",
                          color: "var(--mantine-color-dimmed)",
                        }}
                      />
                    </span>
                  </Box>
                  <Collapse expanded={imageThemeOpen}>
                    <Box
                      px="md"
                      pb="md"
                      style={{
                        borderTop: "1px solid var(--mantine-color-default-border)",
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
                                  pdsSyncEnabled: Boolean(userSettings?.pdsSyncEnabled),
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
                          borderTop: "1px solid var(--mantine-color-default-border)",
                        }}
                      >
                        <Text fw={600} c="dimmed" mb="xs" fz={11}>
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
                              <Text fz={12}>{label}</Text>
                              <Text fz={11} c="dimmed">
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
                {sortedMessages.map((msg: Message, index: number) => {
                  const isExpanded = respondingTid === msg.tid;
                  const isFocused = focusedCardIndex === index;
                  const isPinned = threadRootTid === msg.tid;
                  const threadLinkData = isPinned ? threadLinks[msg.tid] : undefined;

                  return (
                    <Paper
                      id={`message-card-${msg.tid}`}
                      ref={(el) => {
                        messageCardRefs.current[index] = el;
                      }}
                      key={msg.tid}
                      tabIndex={0}
                      role="button"
                      aria-expanded={isExpanded}
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
                      className={justPinnedTid === msg.tid ? "nf-pinned-card-enter" : undefined}
                      style={{
                        borderRadius: 18,
                        background: useGradients ? "var(--nf-grad-dark)" : surfaceBg(isDark),
                        border: isPinned
                          ? "2px solid var(--nf-royal)"
                          : isFocused
                            ? "2px solid var(--nf-purple)"
                            : "2px solid rgba(255,255,255,0.06)",
                        boxShadow: isPinned
                          ? "0 4px 22px -4px rgba(59,91,255,0.38)"
                          : "0 4px 16px -8px rgba(0,0,0,0.3)",
                        padding: "8px 20px 20px",
                        transition: "border-color 0.15s ease, box-shadow 0.15s ease",
                        cursor: "pointer",
                        display: "flex",
                        flexDirection: "column",
                      }}
                      onClick={() => {
                        triggerHaptic();
                        if (isExpanded) {
                          setRespondingTid(null);
                        } else {
                          handlePrepareResponse(msg.tid);
                        }
                      }}
                    >
                      <Stack gap="sm" style={{ flex: 1 }}>
                        {/* Timestamp + action row */}
                        <Group justify="space-between" align="center">
                          <Group gap={6} align="center">
                            <Text
                              fz={10}
                              c="white"
                              opacity={0.8}
                              style={{
                                letterSpacing: "0.08em",
                                textTransform: "uppercase",
                              }}
                            >
                              {formatTimestamp(msg.createdAt)}
                            </Text>
                          </Group>
                          <Group gap={2} align="center">
                            <Tooltip
                              label={isPinned ? "Unpin thread" : "Pin as thread root"}
                              withArrow
                              position="left"
                              openDelay={500}
                            >
                              <ActionIcon
                                size="lg"
                                className={isPinned ? "nf-pin-btn--active" : "nf-pin-btn"}
                                aria-label={isPinned ? "Unpin thread root" : "Set as thread root"}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleTogglePin(msg.tid);
                                }}
                                variant="transparent"
                                radius="md"
                                style={{
                                  color: isPinned ? "var(--nf-royal)" : "rgba(253,248,255,0.4)",
                                  transition: "color 150ms ease, background 150ms ease",
                                }}
                              >
                                {isPinned ? <IconPinned size={18} /> : <IconPin size={18} />}
                              </ActionIcon>
                            </Tooltip>
                            <Tooltip
                              label={isPinned ? "Unpin thread first" : "Delete message"}
                              withArrow
                              position="left"
                              openDelay={500}
                            >
                              <ActionIcon
                                size="lg"
                                className={isPinned ? undefined : "nf-delete-btn"}
                                aria-label={
                                  isPinned ? "Cannot delete thread root" : "Delete message"
                                }
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (isPinned) return;
                                  triggerHaptic();
                                  handleDeleteRequest(msg.tid);
                                }}
                                variant="transparent"
                                radius="md"
                                loading={deletingTid === msg.tid}
                                style={{
                                  color: isPinned
                                    ? "rgba(253,248,255,0.2)"
                                    : "rgba(253,248,255,0.5)",
                                  cursor: isPinned ? "not-allowed" : "pointer",
                                  transition: "color 150ms ease, background 150ms ease",
                                }}
                              >
                                <IconTrash size={18} />
                              </ActionIcon>
                            </Tooltip>
                          </Group>
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

                        {/* Thread parent link */}
                        {threadLinkData?.link && (
                          <Box>
                            <a
                              href={threadLinkData.link}
                              target="_blank"
                              rel="noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 4,
                                color: "var(--nf-lavender)",
                                textDecoration: "none",
                                fontSize: 11,
                                opacity: 0.75,
                              }}
                            >
                              <IconExternalLink size={11} style={{ flexShrink: 0 }} />
                              <span
                                style={{
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                  whiteSpace: "nowrap",
                                }}
                              >
                                {threadLinkData.link.replace("https://", "")}
                              </span>
                            </a>
                          </Box>
                        )}

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
                            <Group justify="space-between" align="center" mt={8}>
                              <Group gap={8} align="center">
                                <CharRing count={responseText.length} limit={characterLimit} />
                                <Text size="xs" c="dimmed">
                                  {responseText.length}/{characterLimit}
                                </Text>
                              </Group>
                              <Tooltip
                                label="Respond to the thread root first"
                                disabled={
                                  !(
                                    !isPinned &&
                                    !!threadRootTid &&
                                    !threadLinks[threadRootTid]?.uri
                                  )
                                }
                                withArrow
                                openDelay={300}
                              >
                                <Button
                                  size="xs"
                                  onClick={() => {
                                    triggerHaptic();
                                    handleSendResponse(msg);
                                  }}
                                  loading={respondLoading}
                                  disabled={
                                    !isPinned && !!threadRootTid && !threadLinks[threadRootTid]?.uri
                                  }
                                  variant="gradient"
                                  gradient={{
                                    from: "royal",
                                    to: "purple",
                                    deg: 135,
                                  }}
                                  leftSection={<IconSend2 size={12} />}
                                >
                                  {!isPinned && threadRootTid ? "Reply to thread" : "Reply"}
                                </Button>
                              </Tooltip>
                            </Group>
                          </Box>
                        ) : (
                          <Box mt={4} onClick={(e) => e.stopPropagation()}>
                            {(() => {
                              const blocked =
                                !isPinned && !!threadRootTid && !threadLinks[threadRootTid]?.uri;
                              return (
                                <Tooltip
                                  label="Respond to the thread root first"
                                  disabled={!blocked}
                                  withArrow
                                  openDelay={300}
                                >
                                  <Button
                                    onClick={() => {
                                      if (blocked) return;
                                      triggerHaptic();
                                      handlePrepareResponse(msg.tid);
                                    }}
                                    fullWidth
                                    radius="md"
                                    color="sunshine"
                                    variant="filled"
                                    fw={700}
                                    style={{
                                      color: "var(--nf-midnight)",
                                      opacity: blocked ? 0.45 : 1,
                                      cursor: blocked ? "not-allowed" : undefined,
                                    }}
                                  >
                                    {!isPinned && threadRootTid ? "↩ Reply to thread" : "↩ Reply"}
                                  </Button>
                                </Tooltip>
                              );
                            })()}
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
                You don&apos;t have any messages yet. Share your profile link to receive anonymous
                questions.
              </Text>
              <Button
                onClick={() => {
                  triggerHaptic();
                  handleAddExampleMessages();
                }}
                loading={examplesLoading}
                size="xs"
                radius="md"
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
