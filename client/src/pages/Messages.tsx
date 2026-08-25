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
import { resolveApiErrorMessage } from "../lib/i18n/apiErrors";
import { useTranslations } from "../lib/i18n";
import { getTouchpointTranslations } from "../lib/touchpointTranslations";
import { useMessagePreferences } from "../lib/useMessagePreferences";
import { useQuestionRender } from "../lib/useQuestionRender";
import { useThreadRoot } from "../lib/useThreadRoot";
import { sunshineButton } from "../styles/tokens";

const shortlinkurl = import.meta.env.VITE_SHORTLINK_URL || "localhost:5173/profile";

const MAX_BSKY_POST_LENGTH = 280;
const GENERAL_BUFFER = 3;
/** How the question is quoted into the post when it is not sent as an image. */
const quotedQuestion = (message: string) =>
  ` \\n\\nAnon asked via 💙📩❓: *${message}*`; /* i18n-allow: budget-only, mirrors the server's own quoting, never rendered by this client */

/** /messages/respond's answer when the render it was handed is not ready yet. */
const RENDER_NOT_READY = 409;

/** A reply the user has committed to, waiting on its question image. */
interface QueuedSend {
  message: Message;
  response: string;
}

export default function Messages() {
  const { triggerHaptic } = useHaptic(1);
  const messages = useTranslations();
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
        title: messages.messagesPage.themeUpdateErrorTitle,
        message: resolveApiErrorMessage(error, messages),
        color: "red",
      });
    },
  });

  const [respondingTid, setRespondingTid] = useState<string | null>(null);
  const [responseText, setResponseText] = useState("");
  const [deleteModalOpened, setDeleteModalOpened] = useState(false);
  const [messageIdToDelete, setMessageIdToDelete] = useState<string | null>(null);
  const [deletingTid, setDeletingTid] = useState<string | null>(null);
  const [queuedSend, setQueuedSend] = useState<QueuedSend | null>(null);

  const respondingMessage = messagesData?.messages?.find((m) => m.tid === respondingTid) ?? null;
  const render = useQuestionRender({
    target: respondingMessage
      ? { tid: respondingMessage.tid, original: respondingMessage.message }
      : null,
    theme: userSettings?.imageTheme,
    enabled: includeQuestionAsImage,
  });

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
          title: messages.messagesPage.addExamplesErrorTitle,
          message: resolveApiErrorMessage(err, messages),
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
        if (respondingTid === tid) closeComposer();
        closeModal();
        refetchMessages().finally(() => setDeletingTid(null));
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      onError: (err: any) => {
        notifications.show({
          title: messages.messagesPage.deleteErrorTitle,
          message: resolveApiErrorMessage(err, messages),
          color: "red",
        });
        closeModal();
        setDeletingTid(null);
      },
    });
  };

  /**
   * The open composer is what the render follows, so moving it while a send is
   * waiting would hand that send the *new* question's image. `claimReady` only
   * checks the DID, so the wrong image would post to Bluesky rather than be
   * rejected.
   *
   * @see [Messages.test.tsx](../tests/pages/Messages.test.tsx) — "opening
   * another question while a send waits on its render does not move the
   * composer" and "posts the queued reply with its own question's render".
   */
  const openComposer = (tid: string) => {
    if (queuedSend) return;
    setRespondingTid(tid);
    setResponseText("");
  };

  /** Abandons the queued send too: a reply nobody is waiting for must not post. */
  const closeComposer = () => {
    setRespondingTid(null);
    setQueuedSend(null);
  };

  const handleDeleteRequest = (tid: string) => {
    if (confirmBeforeDelete) {
      setMessageIdToDelete(tid);
      setDeleteModalOpened(true);
      return;
    }
    performDelete(tid);
  };

  const postResponse = (message: Message, response: string, renderId?: string) => {
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
        renderId,
      },
      {
        onSuccess: (data) => {
          if (thread.isRoot(message.tid) && data.uri && data.cid) {
            thread.recordReply(message.tid, { uri: data.uri, cid: data.cid, link: data.link });
          }
          closeComposer();
          setResponseText("");
          notifications.show({
            title: replyTo
              ? messages.messagesPage.threadReplyTitle
              : messages.messagesPage.responseSentTitle,
            message: <PostedNotice link={data.link} inThread={!!replyTo} />,
            color: "green",
            autoClose: 8000,
          });
          refetchMessages();
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        onError: (err: any) => {
          // The render was consumed, expired, or never finished. The server told
          // us which, so go back to waiting on it rather than blaming the user.
          if (err.status === RENDER_NOT_READY) {
            render.recover();
            setQueuedSend({ message, response });
            return;
          }
          notifications.show({
            title: messages.messagesPage.responseErrorTitle,
            message: resolveApiErrorMessage(err, messages),
            color: "red",
          });
        },
      }
    );
  };

  /**
   * @see [Messages.test.tsx](../tests/pages/Messages.test.tsx) — "pressing Enter
   * while a response is already in flight does not submit again" and "a second
   * Enter while the question image is still rendering posts once" pin the guard
   * below. Nothing downstream of it is idempotent: /messages/respond creates a
   * fresh Bluesky post per call, and the wait is now long enough to invite a
   * second press.
   */
  const handleSendResponse = (message: Message, response: string) => {
    if (respondLoading || queuedSend) return;

    if (!response.trim()) {
      notifications.show({
        title: messages.messagesPage.emptyResponseTitle,
        message: messages.messagesPage.emptyResponseMessage,
        color: "yellow",
      });
      return;
    }

    if (!includeQuestionAsImage) {
      postResponse(message, response);
      return;
    }

    // Reading a failed render clears it server-side, so a send after one has to
    // ask for a fresh render rather than wait on the key it already reported.
    if (render.status === "failed") render.retry();
    setQueuedSend({ message, response });
  };

  useEffect(() => {
    if (!queuedSend) return;
    // No render to wait for: send it the old way and let the server render it.
    // `idle` belongs here too — the image toggle going off mid-wait, or the open
    // message leaving the list, ends the render without ever settling it, and a
    // status this effect does not release strands the send with no way back.
    if (render.status === "unavailable" || render.status === "idle") {
      setQueuedSend(null);
      postResponse(queuedSend.message, queuedSend.response);
      return;
    }
    if (render.status === "failed") {
      setQueuedSend(null);
      notifications.show({
        title: messages.messagesPage.imageRenderFailedTitle,
        message: render.error || messages.messagesPage.imageRenderFailedMessage,
        color: "red",
      });
      return;
    }
    if (!render.readyRenderId) return;
    setQueuedSend(null);
    postResponse(queuedSend.message, queuedSend.response, render.readyRenderId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queuedSend, render.status, render.readyRenderId]);

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
      <Alert color="red" title={messages.messagesPage.notLoggedInTitle}>
        {messages.messagesPage.notLoggedInMessage}
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
            {messages.messagesPage.heading}
          </Title>
          {!messagesLoading && <MessageCount count={msgCount} />}
        </Box>
      </Group>

      <InboxLinkCard
        shortUrl={shortUrl}
        fullUrl={`https://${shortUrl}`}
        handle={handle}
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
            onExpand={openComposer}
            onCollapse={closeComposer}
            responseText={responseText}
            onResponseTextChange={setResponseText}
            characterLimitFor={characterLimitFor}
            onSend={handleSendResponse}
            sending={respondLoading || queuedSend !== null}
            awaitingRender={queuedSend !== null}
            includesImage={includeQuestionAsImage}
            deletingTid={deletingTid}
            onDelete={handleDeleteRequest}
            onTogglePin={(tid) => {
              triggerHaptic();
              thread.togglePin(tid);
            }}
          />
        </>
      ) : (
        <Alert color="royal" title={messages.messagesPage.noMessagesTitle}>
          <Text fz="sm" mb="sm">
            {messages.messagesPage.noMessagesBody}
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
            {messages.messagesPage.addExampleMessages}
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
        title={messages.messagesPage.deleteConfirmTitle}
        message={messages.messagesPage.deleteConfirmMessage}
        confirmLabel={messages.common.delete}
        cancelLabel={messages.common.cancel}
        destructive
        loading={deletingTid !== null && deletingTid === messageIdToDelete}
      />
    </Box>
  );
}

function MessageCount({ count }: { count: number }) {
  const messages = useTranslations();
  return (
    <Text fz={11} c="dimmed" mt={6} style={{ letterSpacing: "0.05em" }}>
      {count > 0 ? (
        <>
          <span style={{ color: "var(--nf-sunshine)" }} aria-hidden>
            ●
          </span>{" "}
          {messages.messagesPage.newMessagesCount(count)}
        </>
      ) : (
        messages.messagesPage.noMessagesCount
      )}
    </Text>
  );
}

function PostedNotice({ link, inThread }: { link?: string; inThread: boolean }) {
  const messages = useTranslations();
  const summary = inThread
    ? messages.messagesPage.threadReplyPosted
    : messages.messagesPage.responsePosted;
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
  const messages = useTranslations();
  useEffect(() => {
    if (sessionStorage.getItem("newLogin") !== "true") return;
    notifications.show({
      title: messages.messagesPage.welcomeBackTitle,
      message: messages.messagesPage.welcomeBackMessage,
      color: "green",
    });
    sessionStorage.removeItem("newLogin");
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
