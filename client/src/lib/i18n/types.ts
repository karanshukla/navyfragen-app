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
  errorTitle: string;
  accessDeniedMessage: string;
  settingsLoadErrorTitle: string;
  switchedToAccount: (handle: string) => string;
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
  summary: (enabled: number, total: number) => string;
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
  friendGroups: {
    moots: { label: string; emptyText: (appName: string) => string };
    following: { label: string; emptyText: (appName: string) => string };
    oomfs: { label: string; emptyText: (appName: string) => string };
  };
  viewingProfile: string;
  unreadCount: (count: number) => string;
}

export interface AppHeaderMessages {
  disableAnimations: string;
  enableAnimations: string;
  toggleColorScheme: string;
}

export interface HomeMessages {
  titleSuffix: string;
  subtitle: string;
  sellingPoints: {
    fastAndFree: { title: string; body: string };
    spamProtection: { title: string; body: string };
    openSource: { title: string; body: string };
  };
  questionsFeedback: string;
  reachOutOnBluesky: string;
  submitAnIssueOnGitHub: string;
  githubContactLabel: string;
  disclaimer: string;
  welcomeBackGreetingPrefix: string;
  viewYourMessages: string;
  copyProfileLink: string;
  copyLinkButton: string;
  getStarted: string;
  shareTitle: (appName: string) => string;
}

export interface SettingsPageMessages {
  heading: string;
  accountOverview: string;
  updateFailedTitle: string;
  pdsSync: string;
  messagesInInbox: string;
  answersOnPds: string;
  activeSince: string;
  pdsLabel: string;
  installApplication: string;
  installApplicationDescription: string;
  install: string;
  appLanguage: string;
  appLanguageDescription: string;
  openFeedOnBluesky: string;
  dailyNotifications: string;
  viewBotOnBluesky: string;
  followTheBotOnBluesky: string;
  deleteMyData: string;
  deleteAccountTitle: string;
  deleteAccountMessage: string;
  pdsSyncDescription: (appName: string) => string;
  feedTitle: (appName: string) => string;
  feedDescription: (appName: string) => string;
  dailyNotificationsDescription: (appName: string) => string;
  deleteMyDataDescription: (appName: string) => string;
}

export interface CustomisePageMessages {
  heading: string;
  beta: string;
  yourPublicProfile: string;
  yourPublicProfileHelp: string;
  profilePrompt: string;
  profilePromptDescription: string;
  profilePromptPlaceholder: string;
  messageLanguage: string;
  messageLanguageDescription: string;
  profileCardColour: string;
  profileCardColourDescription: string;
  messageIntake: string;
  messageIntakeHelp: string;
  inbox: string;
  inboxDescription: string;
  profanityFilter: string;
  profanityFilterDescription: string;
}

export interface PublicProfilePageMessages {
  messageEmptyError: string;
  recipientNotFoundTitle: string;
  recipientNotFoundMessage: string;
  messageSentTitle: string;
  messageSentBody: string;
  sendFailedTitle: string;
  noBlueskyAccountTitle: string;
  noBlueskyAccountBody: string;
  notOnAppTitle: (appName: string) => string;
  notOnAppBodyPrefix: string;
  notOnAppBodySuffix: string;
  profileLoadFailed: string;
  confirmSendTitle: string;
  confirmSendMessage: string;
  sendMessage: string;
  handleResolveFailed: string;
  sendMessageFailed: string;
}

export interface AskCardMessages {
  clearMessage: string;
}

export interface ProfileCardMessages {
  viewOnBluesky: string;
}

export interface ProfileUrlBarMessages {
  shareFailedTitle: string;
  shareFailedMessage: string;
  copyProfileLinkAriaLabel: string;
  shareProfileLinkAriaLabel: string;
}

export interface LoginPageMessages {
  handleRequired: string;
  handleTooLong: string;
  oauthFailedMessage: string;
  logInToPrefix: string;
  subtitle: string;
  atmosphereHandle: string;
  handlePlaceholder: string;
  continueButton: string;
  disclaimerPrefix: string;
  disclaimerMiddle: string;
  disclaimerSuffix: string;
}

export interface HandleSuggestionsMessages {
  ariaLabel: string;
  noHandlesFound: string;
  startTyping: string;
}

export interface E2ELoginPanelMessages {
  modeNotice: string;
  identifier: string;
  identifierPlaceholder: string;
  appPassword: string;
  appPasswordPlaceholder: string;
  signIn: string;
}

export interface OAuthCallbackMessages {
  missingToken: string;
  loggingIn: string;
  completingAuth: string;
  loginFailed: string;
  tryAgain: string;
  redirectNotice: string;
}

export interface PushNotificationsCardMessages {
  description: string;
  serverUnavailable: string;
  browserUnsupported: string;
  browserBlocked: string;
  toastTitle: string;
  title: string;
}

export interface ShareButtonMessages {
  linkCopiedTitle: string;
  linkCopiedMessage: string;
  copyFailedTitle: string;
  copyFailedMessage: string;
  sharingUnavailableTitle: string;
  sharingUnavailableMessage: string;
  button: string;
}

export interface QuestionRenderMessages {
  renderLost: string;
  renderUnreachable: string;
}

export interface NotificationServiceMessages {
  serverUnavailable: string;
  browserUnsupported: string;
  permissionDenied: string;
  subscriptionMissingEndpoint: string;
}

export interface UpdateAvailableButtonMessages {
  ariaLabel: string;
  buttonLabel: string;
}

export interface UserMenuMessages {
  switchAccountErrorTitle: string;
  userAvatarAltFallback: string;
  accountsLabel: string;
  addAccount: string;
  viewProfile: string;
  logOut: (handle: string | undefined) => string;
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
  home: HomeMessages;
  settingsPage: SettingsPageMessages;
  customisePage: CustomisePageMessages;
  publicProfilePage: PublicProfilePageMessages;
  askCard: AskCardMessages;
  profileCard: ProfileCardMessages;
  profileUrlBar: ProfileUrlBarMessages;
  loginPage: LoginPageMessages;
  handleSuggestions: HandleSuggestionsMessages;
  e2eLoginPanel: E2ELoginPanelMessages;
  oauthCallback: OAuthCallbackMessages;
  pushNotificationsCard: PushNotificationsCardMessages;
  shareButton: ShareButtonMessages;
  questionRender: QuestionRenderMessages;
  notificationService: NotificationServiceMessages;
  updateAvailableButton: UpdateAvailableButtonMessages;
  notFoundPage: NotFoundPageMessages;
}

export interface NotFoundPageMessages {
  title: string;
  message: string;
}
