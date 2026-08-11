import { Alert, Box, Button, Center, Group, Loader, SimpleGrid, Text, Title } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useEffect, useRef, useState } from "react";
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
import { ImageThemePicker } from "../components/messages/ImageThemePicker";
import { InboxLinkCard } from "../components/messages/InboxLinkCard";
import { PostingPreferences } from "../components/messages/PostingPreferences";
import { QuestionGrid } from "../components/messages/QuestionGrid";
import { getTouchpointTranslations } from "../lib/touchpointTranslations";
import { useMessagePreferences } from "../lib/useMessagePreferences";
import { useThreadRoot } from "../lib/useThreadRoot";
import { sunshineButton } from "../styles/tokens";

const shortlinkurl = import.meta.env.VITE_SHORTLINK_URL || "localhost:5173/profile";

const MAX_BSKY_POST_LENGTH = 280;
const GENERAL_BUFFER = 3;
/** How the question is quoted into the post when it is not sent as an image. */
const quotedQuestion = (message: string) => ` \\n\\nAnon asked via 💙📩❓: *${message}*`;

export default function Messages() {
  const { triggerHaptic } = useHaptic(1);
  const { data: session, isLoading: sessionLoading } = useSession();
  const prefs = useMessagePreferences();
  const { appendProfileLink, useGradients, includeQuestionAsImage, confirmBeforeDelete } =
    prefs.preferences;

  const {
    data: messagesData,
    isLoading: messagesLoading,
    refetch: refetchMessages,
  } = useMessages(session?.did || null, {
    refetchInterval: 10000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });

  const thread = useThreadRoot(session?.did, messagesData?.messages);

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

  const [respondingTid, setRespondingTid] = useState<string | null>(null);
  const [responseText, setResponseText] = useState("");
  const [deleteModalOpened, setDeleteModalOpened] = useState(false);
  const [messageIdToDelete, setMessageIdToDelete] = useState<string | null>(null);
  const [deletingTid, setDeletingTid] = useState<string | null>(null);

  const handle = session?.profile?.handle ?? "";
  const shortUrl = `${shortlinkurl}/${handle}`;

  const characterLimitFor = (message: Message) => {
    let budget = MAX_BSKY_POST_LENGTH - GENERAL_BUFFER;
    if (appendProfileLink && handle) budget -= ` ${shortUrl}`.length;
    if (!includeQuestionAsImage) budget -= quotedQuestion(message.message).length;
    return Math.max(0, budget);
  };

  useWelcomeBackToast();
  useScrollToNewMessages(messagesData?.messages, prefs.preferences.autoScrollToMessages);

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

  const performDelete = (tid: string, fromModal = false) => {
    const closeModal = () => {
      if (!fromModal) return;
      setDeleteModalOpened(false);
      setMessageIdToDelete(null);
    };
    setDeletingTid(tid);
    deleteMessage(tid, {
      onSuccess: () => {
        if (respondingTid === tid) setRespondingTid(null);
        closeModal();
        refetchMessages().finally(() => setDeletingTid(null));
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      onError: (err: any) => {
        notifications.show({
          title: "Error Deleting Message",
          message: err.error || "Failed to delete message.",
          color: "red",
        });
        closeModal();
        setDeletingTid(null);
      },
    });
  };

  const handleDeleteRequest = (tid: string) => {
    if (confirmBeforeDelete) {
      setMessageIdToDelete(tid);
      setDeleteModalOpened(true);
      return;
    }
    performDelete(tid);
  };

  const handleSendResponse = (message: Message, response: string) => {
    if (!response.trim()) {
      notifications.show({
        title: "Empty Response",
        message: "Response cannot be empty.",
        color: "yellow",
      });
      return;
    }

    const text = appendProfileLink && handle ? `${response} ${shortUrl}` : response;
    const replyTo = thread.replyTarget(message.tid);

    respondToMessage(
      {
        tid: message.tid,
        recipient: message.recipient,
        original: message.message,
        response: text,
        includeQuestionAsImage,
        replyTo,
      },
      {
        onSuccess: (data) => {
          if (thread.isRoot(message.tid) && data.uri && data.cid) {
            thread.recordReply(message.tid, { uri: data.uri, cid: data.cid, link: data.link });
          }
          setRespondingTid(null);
          setResponseText("");
          notifications.show({
            title: replyTo ? "Added to thread!" : "Response Sent!",
            message: <PostedNotice link={data.link} inThread={!!replyTo} />,
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

  const msgCount = messagesData?.messages?.length ?? 0;

  if (sessionLoading) {
    return (
      <Center>
        <Loader size="xl" />
      </Center>
    );
  }

  if (!session?.isLoggedIn) {
    return (
      <Alert color="red" title="Not logged in">
        Please log in to see your messages.
      </Alert>
    );
  }

  const ownerName = session.profile?.displayName || session.profile?.handle || "";
  // Localised because this text leaves the DOM into a tweet/DM, where Google
  // Translate cannot reach it (#266).
  const t = getTouchpointTranslations(userSettings?.touchpointLocale);

  return (
    <Box maw={1080}>
      <Group justify="space-between" align="flex-end" mb="lg" wrap="wrap" gap="sm">
        <Box>
          <Title order={1} style={{ letterSpacing: "-0.03em" }}>
            Messages
          </Title>
          {!messagesLoading && <MessageCount count={msgCount} />}
        </Box>
      </Group>

      <InboxLinkCard
        shortUrl={shortUrl}
        fullUrl={`https://${shortUrl}`}
        shareData={{
          title: t.inboxShareTitle,
          text: t.inboxShareText(ownerName),
          url: `https://${shortUrl}`,
        }}
      />

      {messagesLoading ? (
        <Center>
          <Loader size="lg" />
        </Center>
      ) : msgCount > 0 ? (
        <>
          <SimpleGrid
            cols={{ base: 1, md: 2 }}
            spacing="md"
            mb="lg"
            style={{ alignItems: "start" }}
          >
            <PostingPreferences state={prefs} />
            <ImageThemePicker
              selected={settingsLoading ? null : (userSettings?.imageTheme ?? null)}
              disabled={settingsLoading || updateSettings.isPending}
              onSelect={(imageTheme) =>
                updateSettings.mutate({
                  imageTheme,
                  pdsSyncEnabled: Boolean(userSettings?.pdsSyncEnabled),
                })
              }
            />
          </SimpleGrid>

          <QuestionGrid
            messages={thread.ordered}
            thread={thread}
            gradient={useGradients}
            respondingTid={respondingTid}
            onExpand={(tid) => {
              setRespondingTid(tid);
              setResponseText("");
            }}
            onCollapse={() => setRespondingTid(null)}
            responseText={responseText}
            onResponseTextChange={setResponseText}
            characterLimitFor={characterLimitFor}
            onSend={handleSendResponse}
            sending={respondLoading}
            deletingTid={deletingTid}
            onDelete={handleDeleteRequest}
            onTogglePin={(tid) => {
              triggerHaptic();
              thread.togglePin(tid);
            }}
          />
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
            style={sunshineButton}
          >
            Add example messages
          </Button>
        </Alert>
      )}

      <ConfirmationModal
        opened={deleteModalOpened}
        onClose={() => {
          if (!deleteLoading) {
            setDeleteModalOpened(false);
            setMessageIdToDelete(null);
          }
        }}
        onConfirm={() => performDelete(messageIdToDelete!, true)}
        title="Confirm Deletion"
        message="Are you sure you want to delete this message? This action cannot be undone."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        destructive
        loading={deletingTid !== null && deletingTid === messageIdToDelete}
      />
    </Box>
  );
}

function MessageCount({ count }: { count: number }) {
  return (
    <Text fz={11} c="dimmed" mt={6} style={{ letterSpacing: "0.05em" }}>
      {count > 0 ? (
        <>
          <span style={{ color: "var(--nf-sunshine)" }} aria-hidden>
            ●
          </span>{" "}
          {count} new
        </>
      ) : (
        "no messages"
      )}
    </Text>
  );
}

function PostedNotice({ link, inThread }: { link?: string; inThread: boolean }) {
  const summary = inThread ? "Added to thread." : "Your response has been posted.";
  if (!link) return <>{summary}</>;
  return (
    <>
      {summary}{" "}
      <a
        href={link}
        target="_blank"
        rel="noreferrer"
        style={{ color: "inherit", textDecoration: "underline" }}
      >
        {link}
      </a>
    </>
  );
}

/** One-shot greeting after the OAuth round trip lands back on this page. */
function useWelcomeBackToast() {
  useEffect(() => {
    if (sessionStorage.getItem("newLogin") !== "true") return;
    notifications.show({
      title: "Welcome back!",
      message: "You have successfully logged in.",
      color: "green",
    });
    sessionStorage.removeItem("newLogin");
  }, []);
}

/** Brings a newly arrived question into view, but only if it landed off screen. */
function useScrollToNewMessages(messages: Message[] | undefined, enabled: boolean) {
  const previousCount = useRef(0);

  useEffect(() => {
    const count = messages?.length ?? 0;
    const grew = count > previousCount.current;
    previousCount.current = count;
    if (!enabled || !grew || !messages?.[0]) return;

    const newest = document.getElementById(`message-card-${messages[0].tid}`);
    /* istanbul ignore next */
    if (!newest) return;
    const { top, bottom } = newest.getBoundingClientRect();
    if (top >= window.innerHeight || bottom <= 0) {
      newest.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [messages, enabled]);
}
