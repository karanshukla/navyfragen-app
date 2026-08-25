import { Container, Group, Text } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useState, useRef, useEffect } from "react";
import { useParams } from "react-router";

import { useSendMessage } from "../api/messageService";
import { useResolveHandle, usePublicProfile } from "../api/profileService";
import { ConfirmationModal } from "../components/ConfirmationModal";
import { AskCard } from "../components/profile/AskCard";
import { ProfileCard } from "../components/profile/ProfileCard";
import { ProfileNotice } from "../components/profile/ProfileNotice";
import { ProfileSkeleton } from "../components/profile/ProfileSkeleton";
import { ProfileUrlBar } from "../components/profile/ProfileUrlBar";
import { APP_NAME } from "../lib/brand";
import { useTranslations } from "../lib/i18n";
import type { Messages } from "../lib/i18n/types";
import { profileCardGradient } from "../lib/themes";
import { getTouchpointTranslations } from "../lib/touchpointTranslations";
import * as styles from "./PublicProfile.styles";

const MAX_MESSAGE_LENGTH = 150;

export default function PublicProfile() {
  const messages = useTranslations();
  const { handle } = useParams<{ handle: string }>();
  const [message, setMessage] = useState("");
  const [modalOpened, setModalOpened] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
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

  useFocusScroll(textareaRef);
  useRevealAskCard(askCardRef, !handleLoading && !profileLoading && !!profile);

  const handleSend = () => {
    setFormError(null);
    if (!message.trim()) {
      setFormError(messages.publicProfilePage.messageEmptyError);
      return;
    }
    setModalOpened(true);
  };

  const handleConfirmSend = () => {
    if (!profileData?.profile?.did) {
      notifications.show({
        title: messages.publicProfilePage.recipientNotFoundTitle,
        message: messages.publicProfilePage.recipientNotFoundMessage,
        color: "red",
      });
      setModalOpened(false);
      return;
    }
    sendMessage(
      { recipient: profileData.profile.did, message },
      {
        onSuccess: () => {
          notifications.show({
            title: messages.publicProfilePage.messageSentTitle,
            message: messages.publicProfilePage.messageSentBody,
            color: "green",
          });
          setMessage("");
          setModalOpened(false);
        },
        onError: (err: unknown) => {
          notifications.show({
            title: messages.publicProfilePage.sendFailedTitle,
            message: sendFailureMessage(messages, err),
            color: "red",
          });
          setModalOpened(false);
        },
      }
    );
  };

  if (handleError) {
    const { is404, message: errMessage } = describeHandleError(messages, handleError);
    return is404 ? (
      <ProfileNotice tone="yellow" title={messages.publicProfilePage.noBlueskyAccountTitle}>
        <strong>@{handle}</strong> {messages.publicProfilePage.noBlueskyAccountBody}
      </ProfileNotice>
    ) : (
      <ProfileNotice tone="red" title={messages.common.errorTitle}>
        {errMessage}
      </ProfileNotice>
    );
  }

  if (handleLoading || profileLoading) return <ProfileSkeleton />;

  if (did && profileData && !profileData.exists) {
    return (
      <ProfileNotice tone="yellow" title={messages.publicProfilePage.notOnAppTitle(APP_NAME)}>
        <strong>@{handle}</strong> {messages.publicProfilePage.notOnAppBodyPrefix}
        {APP_NAME}
        {messages.publicProfilePage.notOnAppBodySuffix}
      </ProfileNotice>
    );
  }

  if (!profile) {
    return (
      <ProfileNotice tone="red" title={messages.common.errorTitle}>
        {messages.publicProfilePage.profileLoadFailed}
      </ProfileNotice>
    );
  }

  const t = getTouchpointTranslations(profileData?.touchpointLocale ?? null);
  const ownerName = profile.displayName || profile.handle || "";
  const profileUrl = `https://fragen.navy/${profile.handle}`;

  return (
    <Container>
      <ProfileUrlBar
        handle={profile.handle!}
        url={profileUrl}
        shareTitle={t.shareTitle(ownerName)}
      />

      <ProfileCard profile={profile} />

      <AskCard
        gradient={profileCardGradient(profileData?.profileCardTheme ?? null)}
        headline={profileData?.customPrompt || t.headline(ownerName)}
        maxLength={MAX_MESSAGE_LENGTH}
        value={message}
        onChange={setMessage}
        onSend={handleSend}
        sending={sendLoading}
        // The server sends a real boolean; undefined means the field was absent.
        open={profileData?.inboxEnabled !== false}
        error={formError}
        onDismissError={() => setFormError(null)}
        translations={t}
        cardRef={askCardRef}
        textareaRef={textareaRef}
      />

      <Group gap="xs" mt="md" align="flex-start" style={styles.disclaimer}>
        <Text size="xs" c="dimmed">
          {t.disclaimer}
        </Text>
      </Group>

      <ConfirmationModal
        opened={modalOpened}
        onClose={() => setModalOpened(false)}
        onConfirm={handleConfirmSend}
        title={messages.publicProfilePage.confirmSendTitle}
        message={messages.publicProfilePage.confirmSendMessage}
        confirmLabel={messages.publicProfilePage.sendMessage}
        cancelLabel={messages.common.cancel}
      />
    </Container>
  );
}

function describeHandleError(
  messages: Messages,
  error: unknown
): { is404: boolean; message: string } {
  const fields = (typeof error === "object" && error !== null ? error : {}) as Record<
    string,
    unknown
  >;
  return {
    is404: fields.status === 404,
    message:
      typeof fields.error === "string"
        ? fields.error
        : messages.publicProfilePage.handleResolveFailed,
  };
}

function sendFailureMessage(messages: Messages, err: unknown): string {
  const fields = err as Record<string, unknown>;
  if (typeof fields?.message === "string") return fields.message;
  if (typeof fields?.error === "string") return fields.error;
  return messages.publicProfilePage.sendMessageFailed;
}

/** Keeps the composer in view when a soft keyboard opens under it. */
function useFocusScroll(ref: React.RefObject<HTMLTextAreaElement | null>) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const scroll = () => el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.addEventListener("focus", scroll);
    return () => el.removeEventListener("focus", scroll);
  }, [ref]);
}

/** Scrolls the ask card up if a tall banner or bio pushed it off screen. */
function useRevealAskCard(ref: React.RefObject<HTMLDivElement | null>, ready: boolean) {
  useEffect(() => {
    if (!ready || !ref.current) return;
    if (ref.current.getBoundingClientRect().bottom <= window.innerHeight) return;
    ref.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [ready, ref]);
}
