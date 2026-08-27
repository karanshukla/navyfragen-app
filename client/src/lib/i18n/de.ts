import type { Messages } from "./types";

const numberFormat = new Intl.NumberFormat("de");

/**
 * `Intl.PluralRules("de").select(count)` returns "one" only for exactly 1,
 * same as English. This codebase's German count labels are bare predicate
 * adjectives ("3 neu", "3 ungelesen") that don't inflect for number, so
 * `pluralize` below is kept only for structural parity with the other
 * locales — both branches carry the same word.
 */
const pluralRules = new Intl.PluralRules("de");

function pluralize(count: number, singular: string, plural: string): string {
  return pluralRules.select(count) === "one" ? singular : plural;
}

export const de = {
  common: {
    cancel: "Abbrechen",
    confirm: "Bestätigen",
    delete: "Löschen",
    retry: "Erneut versuchen",
    copy: "Kopieren",
    copied: "Kopiert!",
    copyLink: "Link kopieren",
    share: "Teilen",
    userAltFallback: "Nutzer",
    respondToThreadRootFirst: "Antworte zuerst auf die Ausgangsnachricht des Threads",
    errorTitle: "Fehler",
    accessDeniedMessage: "Du kannst diese Seite nicht ohne Anmeldung aufrufen.",
    settingsLoadErrorTitle: "Einstellungen konnten nicht geladen werden",
    switchedToAccount: (handle: string) => `Zu @${handle} gewechselt`,
    shortcuts: {
      title: "Tastenkürzel",
      home: "Start",
      login: "Anmelden",
      messages: "Nachrichten",
      settings: "Einstellungen",
      customise: "Anpassen",
      focusCycleCards: "Karten fokussieren / durchblättern",
      navigateCards: "Zwischen Karten navigieren",
      closeExpandedCard: "Erweiterte Karte schließen",
    },
  },
  messagesPage: {
    themeUpdateErrorTitle: "Fehler beim Aktualisieren des Themes",
    addExamplesErrorTitle: "Fehler beim Hinzufügen von Beispielen",
    deleteErrorTitle: "Fehler beim Löschen der Nachricht",
    threadReplyTitle: "Zum Thread hinzugefügt!",
    responseSentTitle: "Antwort gesendet!",
    responseErrorTitle: "Fehler beim Antworten",
    emptyResponseTitle: "Leere Antwort",
    emptyResponseMessage: "Die Antwort darf nicht leer sein.",
    imageRenderFailedTitle: "Bild konnte nicht erstellt werden",
    imageRenderFailedMessage: "Das Bild der Frage konnte nicht erstellt werden.",
    notLoggedInTitle: "Nicht angemeldet",
    notLoggedInMessage: "Bitte melde dich an, um deine Nachrichten zu sehen.",
    heading: "Nachrichten",
    noMessagesCount: "keine Nachrichten",
    newMessagesCount: (count: number) =>
      `${numberFormat.format(count)} ${pluralize(count, "neu", "neu")}`,
    noMessagesTitle: "Keine Nachrichten",
    noMessagesBody:
      "Du hast noch keine Nachrichten. Teile deinen Posteingangslink, um anonyme Fragen zu erhalten.",
    addExampleMessages: "Beispielnachrichten hinzufügen",
    deleteConfirmTitle: "Löschen bestätigen",
    deleteConfirmMessage:
      "Möchtest du diese Nachricht wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.",
    threadReplyPosted: "Zum Thread hinzugefügt.",
    responsePosted: "Deine Antwort wurde veröffentlicht.",
    welcomeBackTitle: "Willkommen zurück!",
    welcomeBackMessage: "Du hast dich erfolgreich angemeldet.",
  },
  inboxLinkCard: {
    eyebrow: "Dein Posteingangslink · öffentlich zugänglich",
  },
  postingPreferences: {
    title: "Veröffentlichungseinstellungen",
    appendProfileLink: {
      label: "Posteingangslink automatisch anhängen",
      description: "Fügt deinen Link an jeden Beitrag an. Verringert das Zeichenbudget.",
    },
    useGradients: {
      label: "Farbverlauf-Hintergründe",
      description: "Hübsch für Screenshots. Für mehr Kontrast deaktivieren.",
    },
    includeQuestionAsImage: {
      label: "Frage als Bild",
      description: "Erstellt ein teilbares Bild mit automatischem Alt-Text.",
    },
    confirmBeforeDelete: {
      label: "Vor dem Löschen bestätigen",
      description: "Deaktivieren, wenn du Nachrichten in großer Zahl löschen möchtest.",
    },
    autoScrollToMessages: {
      label: "Automatisch zu Nachrichten scrollen",
      description: "Scrollt neue Nachrichten beim Laden in den sichtbaren Bereich.",
    },
    summary: (enabled: number, total: number) =>
      `${numberFormat.format(enabled)} von ${numberFormat.format(total)} aktiv`,
  },
  questionCard: {
    cannotDeleteThreadRootTooltip: "Thread zuerst lösen",
    cannotDeleteThreadRootLabel: "Thread-Ausgangsnachricht kann nicht gelöscht werden",
    cannotDeleteWhilePostingTooltip: "Veröffentlichung zuerst abschließen",
    cannotDeleteWhilePostingLabel: "Löschen während der Veröffentlichung nicht möglich",
    unpinThreadTooltip: "Thread lösen",
    pinAsThreadRootTooltip: "Als Thread-Ausgang anheften",
    unpinThreadRootLabel: "Thread-Ausgangsnachricht lösen",
    setAsThreadRootLabel: "Als Thread-Ausgangsnachricht festlegen",
    deleteMessageTooltip: "Nachricht löschen",
    deleteMessageLabel: "Nachricht löschen",
    replyToThread: "↩ Auf Thread antworten",
    reply: "↩ Antworten",
  },
  replyComposer: {
    stillRenderingImage: "Bild deiner Frage wird noch erstellt…",
    renderingImage: "Bild deiner Frage wird erstellt…",
    posting: "Wird veröffentlicht…",
    stillGoingWakingRenderer: "Dauert noch an, Bildgenerator wird geweckt…",
    stillGoing: "Dauert noch an…",
    responseAriaLabel: "Deine Antwort",
    placeholder: "schreib deine Antwort…",
    replyToThread: "Auf Thread antworten",
    reply: "Antworten",
  },
  imageThemePicker: {
    title: "Bild-Theme",
  },
  themes: {
    image: {
      default: "Standard",
      compressed: "Komprimiert",
      twitter: "Twitter-Stil",
    },
    profileCard: {
      royal: "Königlich",
      aurora: "Aurora",
      ember: "Glut",
      verdant: "Sattgrün",
    },
  },
  nav: {
    friendGroups: {
      moots: {
        label: "Gegenseitig",
        emptyText: (appName: string) => `Noch keine gegenseitigen Follows auf ${appName}.`,
      },
      following: {
        label: "Folge ich",
        emptyText: (appName: string) => `Noch keine einseitigen Follows auf ${appName}.`,
      },
      oomfs: {
        label: "Oomfs",
        emptyText: (appName: string) => `Noch keiner deiner Follower ist auf ${appName}.`,
      },
    },
    viewingProfile: "Profil ansehen",
    unreadCount: (count: number) =>
      `${numberFormat.format(count)} ${pluralize(count, "ungelesen", "ungelesen")}`,
  },
  appHeader: {
    disableAnimations: "Animationen deaktivieren",
    enableAnimations: "Animationen aktivieren",
    toggleColorScheme: "Farbschema wechseln",
  },
  customisePage: {
    heading: "Anpassen",
    beta: "Beta",
    yourPublicProfile: "Dein öffentliches Profil",
    yourPublicProfileHelp: "Was Besucher sehen, bevor sie dir eine anonyme Nachricht senden.",
    profilePrompt: "Profiltext",
    profilePromptDescription:
      "Die Überschrift über deinem Nachrichtenfeld. Leer lassen, um „Sende [dir] eine anonyme Nachricht” zu verwenden.",
    profilePromptPlaceholder: "Frag mich etwas…",
    profileCardColour: "Profilkarten-Farbe",
    profileCardColourDescription:
      "Die Farbgestaltung deiner Frage-Karte. Die kuratierten Voreinstellungen halten Text und Buttons bei jeder Option gut lesbar.",
    languages: "Sprachen",
    languagesHelp:
      "Zwei Zielgruppen, zwei Sprachen: die, in der du die App liest, und die, in der deine Besucher lesen.",
    appLanguage: "App-Sprache",
    appLanguageDescription:
      "Die Sprache, in der du die App liest: Navigation, Buttons und Benachrichtigungen. Nur du siehst sie.",
    messageLanguage: "Nachrichtensprache",
    messageLanguageDescription:
      "Sprache des Prompts, des Freigabetexts und des Anonymitätshinweises, den Besucher und dein Publikum sehen. Dein eigener Profiltext hat Vorrang vor dieser Einstellung.",
    messageIntake: "Nachrichteneingang",
    messageIntakeHelp: "Wer deinen Posteingang erreichen kann und was durchgelassen wird.",
    inbox: "Posteingang",
    inboxDescription:
      "Deaktivieren, um keine neuen Nachrichten mehr zu erhalten – dein Konto, Verlauf und deine Einstellungen bleiben erhalten. Besucher sehen den Status „nimmt keine Nachrichten an”.",
    profanityFilter: "Schimpfwortfilter",
    profanityFilterDescription:
      "Wenn aktiviert, werden eingehende Nachrichten anhand einer englischsprachigen Wortliste geprüft – andere Sprachen werden nicht gefiltert. Markierte Nachrichten werden stillschweigend verworfen – der Absender sieht eine Erfolgsmeldung, aber die Nachricht erreicht deinen Posteingang nie.",
  },
  publicProfilePage: {
    messageEmptyError: "Die Nachricht darf nicht leer sein.",
    recipientNotFoundTitle: "Fehler",
    recipientNotFoundMessage: "Nachricht kann nicht gesendet werden: Nutzer-DID nicht gefunden.",
    messageSentTitle: "Nachricht gesendet!",
    messageSentBody: "Deine anonyme Nachricht ist unterwegs.",
    sendFailedTitle: "Senden fehlgeschlagen",
    noBlueskyAccountTitle: "Kein Bluesky-Konto gefunden",
    noBlueskyAccountBody:
      "existiert nicht auf Bluesky. Überprüfe den Nutzernamen und versuche es erneut.",
    notOnAppTitle: (appName: string) => `Nicht auf ${appName}`,
    notOnAppBodyPrefix: "hat ein Bluesky-Konto, aber den Posteingang auf ",
    notOnAppBodySuffix: " noch nicht eingerichtet.",
    profileLoadFailed: "Profilinformationen konnten nicht geladen werden.",
    confirmSendTitle: "Anonyme Nachricht bestätigen",
    confirmSendMessage:
      "Möchtest du diese anonyme Nachricht wirklich senden? Diese Aktion kann nicht rückgängig gemacht werden.",
    sendMessage: "Nachricht senden",
    handleResolveFailed:
      "Nutzername konnte nicht aufgelöst werden. Er existiert möglicherweise nicht.",
    sendMessageFailed: "Nachricht konnte nicht gesendet werden. Bitte versuche es erneut.",
  },
  askCard: {
    clearMessage: "Nachricht löschen",
  },
  profileCard: {
    viewOnBluesky: "Auf Bluesky ansehen",
  },
  profileUrlBar: {
    shareFailedTitle: "Teilen fehlgeschlagen",
    shareFailedMessage: "Der Link konnte nicht geteilt werden.",
    copyProfileLinkAriaLabel: "Profillink kopieren",
    shareProfileLinkAriaLabel: "Profillink teilen",
  },
  loginPage: {
    handleRequired: "Nutzername ist erforderlich",
    handleTooLong: "Nutzername zu lang",
    oauthFailedMessage: "Anmeldung fehlgeschlagen. Bitte versuche es erneut.",
    logInToPrefix: "Anmelden bei ",
    subtitle: "Gib deinen AT-Protocol-Nutzernamen ein, um fortzufahren",
    atmosphereHandle: "Atmosphere-Nutzername",
    handlePlaceholder: "z. B. deinname.bsky.social",
    continueButton: "Weiter",
    disclaimerPrefix: "Du wirst zu Bluesky weitergeleitet, um dich zu authentifizieren. ",
    disclaimerMiddle: " hat keinen Zugriff auf dein Passwort. Stelle sicher, dass du ",
    disclaimerSuffix: " auf der Anmeldeseite siehst.",
  },
  handleSuggestions: {
    ariaLabel: "Nutzervorschläge",
    noHandlesFound: "Keine Nutzer gefunden",
    startTyping: "Tippe los, um Nutzervorschläge zu sehen",
  },
  e2eLoginPanel: {
    modeNotice: "E2E-Testmodus – nicht für den Produktionseinsatz",
    identifier: "Kennung",
    identifierPlaceholder: "nutzer.pds.example",
    appPassword: "App-Passwort",
    appPasswordPlaceholder: "xxxx-xxxx-xxxx-xxxx",
    signIn: "Anmelden (E2E)",
  },
  oauthCallback: {
    missingToken: "OAuth-Token fehlt in der Callback-URL.",
    loggingIn: "Du wirst angemeldet…",
    completingAuth: "Deine Bluesky-Authentifizierung wird abgeschlossen",
    loginFailed: "Anmeldung fehlgeschlagen",
    tryAgain: "Erneut versuchen",
    redirectNotice: "Du wirst automatisch weitergeleitet, sobald die Anmeldung abgeschlossen ist.",
  },
  pushNotificationsCard: {
    description:
      "Erhalte eine Push-Benachrichtigung, wenn eine Nachricht eintrifft. Erlaube die Anfrage deines Browsers, um sie zu aktivieren; das Löschen der Website-Daten deaktiviert sie wieder. Gilt für alle auf diesem Gerät angemeldeten Konten.",
    serverUnavailable: "Push ist auf diesem Server nicht konfiguriert.",
    browserUnsupported: "Dieser Browser kann keine Push-Benachrichtigungen empfangen.",
    browserBlocked:
      "In deinen Browsereinstellungen blockiert. Erlaube Benachrichtigungen für diese Website erneut, um sie zu aktivieren.",
    toastTitle: "Push-Benachrichtigungen",
    title: "Push-Benachrichtigungen",
  },
  shareButton: {
    linkCopiedTitle: "Kopiert!",
    linkCopiedMessage: "Link in die Zwischenablage kopiert.",
    copyFailedTitle: "Kopieren fehlgeschlagen",
    copyFailedMessage: "Der Link konnte nicht in die Zwischenablage kopiert werden.",
    sharingUnavailableTitle: "Teilen nicht verfügbar",
    sharingUnavailableMessage: "Dieser Browser unterstützt die Teilen-Funktion nicht.",
    button: "Teilen",
  },
  questionRender: {
    renderLost: "Das Bild der Frage konnte nicht erstellt werden. Versuche es erneut zu senden.",
    renderUnreachable:
      "Das Bild der Frage konnte nicht überprüft werden. Versuche es erneut zu senden.",
  },
  notificationService: {
    serverUnavailable: "Push-Benachrichtigungen sind auf diesem Server nicht verfügbar",
    browserUnsupported: "Push-Benachrichtigungen werden von diesem Browser nicht unterstützt",
    permissionDenied: "Die Benachrichtigungsberechtigung wurde nicht erteilt",
    subscriptionMissingEndpoint: "Das Push-Abonnement hat keinen Endpunkt zurückgegeben",
  },
  updateAvailableButton: {
    ariaLabel: "Update verfügbar — zum Anwenden neu laden",
    buttonLabel: "Update",
    applyingAriaLabel: "Update wird angewendet — die Seite wird neu geladen",
    applyingLabel: "Aktualisiere…",
  },
  userMenu: {
    switchAccountErrorTitle: "Konto konnte nicht gewechselt werden",
    userAvatarAltFallback: "Nutzer-Avatar",
    accountsLabel: "Konten",
    addAccount: "Konto hinzufügen",
    viewProfile: "Profil ansehen",
    logOut: (handle: string | undefined) => `@${handle} abmelden`,
  },
  home: {
    titleSuffix: " - Anonyme Fragen und Antworten auf Bluesky",
    subtitle: "Empfange Fragen aus dem Web und veröffentliche die Antworten direkt auf Bluesky.",
    sellingPoints: {
      fastAndFree: {
        title: "Schnell und kostenlos",
        body: "Kein Download nötig – melde dich einfach mit deinen Bluesky-Zugangsdaten an und teile deinen Posteingangslink",
      },
      spamProtection: {
        title: "Spam-Schutz ohne Captchas",
        body: "Geschützt durch Anubis, einen leistungsstarken Bot-Erkennungsdienst",
      },
      openSource: {
        title: "Open Source",
        body: "Trage direkt zum Projekt bei, oder hoste deine eigene Version, wenn du möchtest!",
      },
    },
    questionsFeedback: "Fragen? Feedback?",
    reachOutOnBluesky: "Melde dich auf Bluesky",
    submitAnIssueOnGitHub: "Ein Issue auf GitHub einreichen",
    githubContactLabel: "GitHub - ",
    disclaimer:
      "Hinweis: Bitte befolge die Nutzungsbedingungen von Bluesky. Cookies werden verwendet, um dich angemeldet zu halten. Diese App enthält keine Moderation.",
    welcomeBackGreetingPrefix: "Schön, dich wiederzusehen,",
    viewYourMessages: "Deine Nachrichten ansehen",
    copyProfileLink: "Profillink kopieren",
    copyLinkButton: "Link kopieren",
    getStarted: "Loslegen",
    shareTitle: (appName: string) => `Sende mir anonyme Nachrichten auf ${appName}!`,
  },
  settingsPage: {
    heading: "Einstellungen",
    accountOverview: "Kontoübersicht",
    updateFailedTitle: "Aktualisierung fehlgeschlagen",
    pdsSync: "PDS-Synchronisierung",
    messagesInInbox: "Nachrichten im Posteingang",
    answersOnPds: "Antworten im PDS",
    activeSince: "Aktiv seit",
    pdsLabel: "PDS",
    installApplication: "Anwendung installieren",
    installApplicationDescription:
      "Installiere die App für schnelleren Zugriff auf jedem Gerät: Handy, Tablet oder Laptop. Sie läuft im selben Browser und du kannst sie jederzeit deinstallieren.",
    install: "Installieren ",
    openFeedOnBluesky: "Feed auf Bluesky öffnen",
    dailyNotifications: "Tägliche Benachrichtigungen",
    viewBotOnBluesky: "Bot auf Bluesky ansehen",
    followTheBotOnBluesky: "Dem Bot auf Bluesky folgen",
    deleteMyData: "Meine Daten löschen",
    deleteAccountTitle: "Konto löschen",
    deleteAccountMessage:
      "Möchtest du dein Konto und alle Daten wirklich löschen? Dies kann nicht rückgängig gemacht werden.",
    pdsSyncDescription: (appName: string) =>
      `${appName} synchronisiert deine anonymen Nachrichten mit deinem Bluesky-PDS (Personal Data Server). Deaktiviere dies, um sie nur auf den Servern von ${appName} zu behalten. Das Posten auf Bluesky ist davon nicht betroffen.`,
    feedTitle: (appName: string) => `${appName}-Feed`,
    feedDescription: (appName: string) =>
      `Entdecke anonyme Fragen und Antworten, die von allen auf ${appName} weltweit veröffentlicht wurden. Dieser Feed kann Inhalte für Erwachsene enthalten. Nutzung auf eigenes Risiko.`,
    dailyNotificationsDescription: (appName: string) =>
      `Folge dem Benachrichtigungsbot von ${appName} auf Bluesky, um täglich eine Erinnerung zu erhalten, wenn neue Nachrichten in deinem Posteingang liegen.`,
    deleteMyDataDescription: (appName: string) =>
      `Entferne alle deine Daten dauerhaft von den Servern von ${appName} und aus dem Bluesky-PDS. Das deaktiviert auch deinen Posteingang, sodass du keine Nachrichten mehr erhältst. Du kannst dich jederzeit wieder anmelden, um dich automatisch neu zu registrieren.`,
  },
  errors: {
    codes: {
      NOT_AUTHENTICATED: "Du bist nicht angemeldet. Bitte melde dich an und versuche es erneut.",
      SESSION_EXPIRED: "Deine Sitzung ist abgelaufen. Bitte melde dich erneut an.",
      ACCOUNT_SESSION_EXPIRED:
        "Die Sitzung dieses Kontos ist abgelaufen. Bitte melde dich erneut an.",
      AGENT_INIT_FAILED: "Wir konnten deine Sitzung nicht überprüfen. Bitte melde dich erneut an.",
      INVALID_HANDLE: "Das sieht nicht nach einem gültigen Bluesky-Nutzernamen aus.",
      INVALID_DID: "Diese Kontokennung ist ungültig.",
      DID_REQUIRED: "Eine Kontokennung ist erforderlich.",
      RECIPIENT_DID_REQUIRED: "Ein Empfänger ist erforderlich.",
      MESSAGE_TID_REQUIRED: "Eine Nachrichtenkennung ist erforderlich.",
      HANDLE_NOT_FOUND: "Wir konnten diesen Nutzernamen nicht finden.",
      USER_NOT_FOUND: "Wir konnten diesen Nutzer nicht finden.",
      PROFILE_NOT_FOUND: "Wir konnten dieses Profil nicht finden.",
      MISSING_OAUTH_TOKEN: "Deinem Anmeldelink fehlt ein erforderliches Token.",
      INVALID_OAUTH_TOKEN: "Dein Anmeldelink ist abgelaufen oder ungültig.",
      SERVER_MISCONFIGURED: "Der Server ist falsch konfiguriert. Bitte versuche es später erneut.",
      LOGOUT_FAILED: "Wir konnten dich nicht abmelden. Bitte versuche es erneut.",
      ACCOUNT_SWITCH_FAILED: "Wir konnten das Konto nicht wechseln. Bitte versuche es erneut.",
      EXAMPLE_MESSAGES_FAILED:
        "Wir konnten keine Beispielnachrichten hinzufügen. Bitte versuche es erneut.",
      MESSAGES_FETCH_FAILED: "Wir konnten deine Nachrichten nicht laden. Bitte versuche es erneut.",
      PDS_SYNC_FAILED:
        "Wir konnten deine Nachrichten nicht synchronisieren. Bitte versuche es erneut.",
      PROFILE_FETCH_FAILED: "Wir konnten dieses Profil nicht laden. Bitte versuche es erneut.",
      USER_EXISTENCE_CHECK_FAILED: "Wir konnten diesen Nutzer gerade nicht überprüfen.",
      FRIENDS_FETCH_FAILED: "Wir konnten deine Freunde nicht laden. Bitte versuche es erneut.",
      BOT_FOLLOW_CHECK_FAILED: "Wir konnten den Bot-Follow-Status nicht überprüfen.",
      PDS_RESOLVE_FAILED: "Wir konnten den Server dieses Nutzernamens nicht auflösen.",
      HANDLE_SEARCH_FAILED: "Wir konnten gerade keine Nutzernamen suchen.",
      HANDLE_RESOLVE_FAILED: "Wir konnten diesen Nutzernamen nicht auflösen.",
      SETTINGS_FETCH_FAILED:
        "Wir konnten deine Einstellungen nicht laden. Bitte versuche es erneut.",
      SETTINGS_UPDATE_FAILED:
        "Wir konnten deine Einstellungen nicht speichern. Bitte versuche es erneut.",
      STATS_FETCH_FAILED: "Wir konnten deine Statistiken nicht laden. Bitte versuche es erneut.",
      PDS_INFO_FETCH_FAILED:
        "Wir konnten deine PDS-Informationen nicht laden. Bitte versuche es erneut.",
      PUSH_NOT_CONFIGURED: "Push-Benachrichtigungen sind auf diesem Server nicht verfügbar.",
      PUSH_SUBSCRIBE_FAILED:
        "Wir konnten Push-Benachrichtigungen nicht aktivieren. Bitte versuche es erneut.",
      PUSH_UNSUBSCRIBE_FAILED:
        "Wir konnten Push-Benachrichtigungen nicht deaktivieren. Bitte versuche es erneut.",
      INBOX_CLOSED:
        "Dieser Posteingang ist geschlossen und nimmt derzeit keine neuen Nachrichten an.",
      MESSAGE_SEND_FAILED: "Wir konnten deine Nachricht nicht senden. Bitte versuche es erneut.",
      MESSAGE_NOT_FOUND: "Wir konnten diese Nachricht nicht finden.",
      MESSAGE_DELETE_NOT_AUTHORIZED:
        "Diese Nachricht gehört dir nicht, du kannst sie nicht löschen.",
      MESSAGE_DELETE_FAILED: "Wir konnten diese Nachricht nicht löschen. Bitte versuche es erneut.",
      BLUESKY_POST_FAILED:
        "Wir konnten deine Antwort nicht auf Bluesky posten. Bitte versuche es erneut.",
      ACCOUNT_DELETE_FAILED:
        "Wir konnten deine Kontodaten nicht löschen. Bitte versuche es erneut.",
      RENDER_QUESTION_NOT_IN_INBOX: "Diese Frage ist nicht mehr in deinem Posteingang.",
      RENDER_START_FAILED: "Wir konnten das Bild nicht erzeugen. Bitte versuche es erneut.",
      LOGIN_INIT_FAILED: "Wir konnten die Anmeldung nicht starten. Bitte versuche es erneut.",
      E2E_LOGIN_UNAVAILABLE: "Der Testlogin ist hier nicht verfügbar.",
      E2E_LOGIN_NO_DID: "Anmeldung fehlgeschlagen. Bitte versuche es erneut.",
    },
    generic: "Etwas ist schiefgelaufen. Bitte versuche es erneut.",
  },
  notFoundPage: {
    title: "404 - Nicht gefunden",
    message: "Die angeforderte Ressource wurde nicht gefunden.",
  },
} satisfies Messages;
