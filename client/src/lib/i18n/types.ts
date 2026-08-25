import type { ErrorCode } from "../contracts";

/**
 * Locales the client bundle can render as a full `Messages` catalog. Distinct
 * from `TouchpointLocale` (`../touchpointTranslations.ts`) — that axis is the
 * profile owner's audience, this one is the logged-in user reading the app.
 * `user_settings.uiLocale` itself is a free-form string column, so a stored
 * value here can be ahead of what this bundle supports; resolution treats
 * anything outside this union as "fall back to `en`" rather than widening it.
 */
export type Locale = "en";

/**
 * Maps every server `ErrorCode` (`../contracts.ts`) to a localized string, plus
 * a generic fallback for a code this catalog doesn't know or an `error` value
 * that isn't a code at all. `Record<ErrorCode, string>` is exhaustive on
 * purpose — an unmapped code fails `bun run typecheck` rather than falling
 * back silently at runtime.
 *
 * @see [apiErrors.ts](./apiErrors.ts): the three-rung resolution this backs —
 * catalog entry, then the server's own `message`, then `generic`.
 */
export interface ErrorMessages {
  codes: Record<ErrorCode, string>;
  generic: string;
}

export interface CommonMessages {
  cancel: string;
  confirm: string;
  delete: string;
  retry: string;
  copy: string;
  copied: string;
  copyLink: string;
  share: string;
  userAltFallback: string;
  respondToThreadRootFirst: string;
  shortcuts: {
    title: string;
    home: string;
    login: string;
    messages: string;
    settings: string;
    customise: string;
    focusCycleCards: string;
    navigateCards: string;
    closeExpandedCard: string;
  };
}

/**
 * Scoped to `errors` on purpose: this ships ahead of #402's ~210-string
 * extraction, so keeping the error-code strings in their own sub-object lets
 * #402 fill in the rest of `Messages` around this without touching it.
 */
export interface MessagesPageMessages {
  themeUpdateErrorTitle: string;
  addExamplesErrorTitle: string;
  deleteErrorTitle: string;
  threadReplyTitle: string;
  responseSentTitle: string;
  responseErrorTitle: string;
  emptyResponseTitle: string;
  emptyResponseMessage: string;
  imageRenderFailedTitle: string;
  imageRenderFailedMessage: string;
  notLoggedInTitle: string;
  notLoggedInMessage: string;
  heading: string;
  noMessagesCount: string;
  newMessagesCount: (count: number) => string;
  noMessagesTitle: string;
  noMessagesBody: string;
  addExampleMessages: string;
  deleteConfirmTitle: string;
  deleteConfirmMessage: string;
  threadReplyPosted: string;
  responsePosted: string;
  welcomeBackTitle: string;
  welcomeBackMessage: string;
}

export interface InboxLinkCardMessages {
  eyebrow: string;
}

export interface PostingPreferencesMessages {
  title: string;
  appendProfileLink: { label: string; description: string };
  useGradients: { label: string; description: string };
  includeQuestionAsImage: { label: string; description: string };
  confirmBeforeDelete: { label: string; description: string };
  autoScrollToMessages: { label: string; description: string };
}

export interface QuestionCardMessages {
  cannotDeleteThreadRootTooltip: string;
  cannotDeleteThreadRootLabel: string;
  cannotDeleteWhilePostingTooltip: string;
  cannotDeleteWhilePostingLabel: string;
  unpinThreadTooltip: string;
  pinAsThreadRootTooltip: string;
  unpinThreadRootLabel: string;
  setAsThreadRootLabel: string;
  deleteMessageTooltip: string;
  deleteMessageLabel: string;
  replyToThread: string;
  reply: string;
}

export interface ReplyComposerMessages {
  stillRenderingImage: string;
  renderingImage: string;
  posting: string;
  stillGoingWakingRenderer: string;
  stillGoing: string;
  responseAriaLabel: string;
  placeholder: string;
  replyToThread: string;
  reply: string;
}

export interface ImageThemePickerMessages {
  title: string;
}

export interface ThemesMessages {
  image: { default: string; compressed: string; twitter: string };
  profileCard: { royal: string; aurora: string; ember: string; verdant: string };
}

export interface NavMessages {
  friendGroups: { moots: string; following: string; oomfs: string };
  viewingProfile: string;
  unreadCount: (count: number) => string;
}

export interface AppHeaderMessages {
  disableAnimations: string;
  enableAnimations: string;
  toggleColorScheme: string;
}

export interface UserMenuMessages {
  switchAccountErrorTitle: string;
  userAvatarAltFallback: string;
  accountsLabel: string;
  addAccount: string;
  viewProfile: string;
}

export interface Messages {
  errors: ErrorMessages;
  common: CommonMessages;
  messagesPage: MessagesPageMessages;
  inboxLinkCard: InboxLinkCardMessages;
  postingPreferences: PostingPreferencesMessages;
  questionCard: QuestionCardMessages;
  replyComposer: ReplyComposerMessages;
  imageThemePicker: ImageThemePickerMessages;
  themes: ThemesMessages;
  nav: NavMessages;
  appHeader: AppHeaderMessages;
  userMenu: UserMenuMessages;
}
