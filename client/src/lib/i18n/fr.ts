import type { Messages } from "./types";

const numberFormat = new Intl.NumberFormat("fr");

/**
 * French agreement is unusual among this catalog's locales:
 * `pluralRules.select(count)` returns "one" for both 0 and 1 (French treats
 * zero as singular, e.g. "0 message"), so only counts of 2 or more take the
 * plural form — unlike English or German, where only exactly 1 is singular.
 */
const pluralRules = new Intl.PluralRules("fr");

function pluralize(count: number, singular: string, plural: string): string {
  return pluralRules.select(count) === "one" ? singular : plural;
}

export const fr = {
  common: {
    cancel: "Annuler",
    confirm: "Confirmer",
    delete: "Supprimer",
    retry: "Réessayer",
    copy: "Copier",
    copied: "Copié !",
    copyLink: "Copier le lien",
    share: "Partager",
    userAltFallback: "Utilisateur",
    respondToThreadRootFirst: "Réponds d'abord au message racine du fil",
    errorTitle: "Erreur",
    accessDeniedMessage: "Tu ne peux pas accéder à cette page sans te connecter.",
    settingsLoadErrorTitle: "Impossible de charger les paramètres",
    switchedToAccount: (handle: string) => `Passé à @${handle}`,
    shortcuts: {
      title: "Raccourcis clavier",
      home: "Accueil",
      login: "Connexion",
      messages: "Messages",
      settings: "Paramètres",
      customise: "Personnaliser",
      focusCycleCards: "Focus / parcourir les cartes",
      navigateCards: "Naviguer entre les cartes",
      closeExpandedCard: "Fermer la carte agrandie",
    },
  },
  messagesPage: {
    themeUpdateErrorTitle: "Erreur lors de la mise à jour du thème",
    addExamplesErrorTitle: "Erreur lors de l'ajout d'exemples",
    deleteErrorTitle: "Erreur lors de la suppression du message",
    threadReplyTitle: "Ajouté au fil !",
    responseSentTitle: "Réponse envoyée !",
    responseErrorTitle: "Erreur de réponse",
    emptyResponseTitle: "Réponse vide",
    emptyResponseMessage: "La réponse ne peut pas être vide.",
    imageRenderFailedTitle: "Échec de la génération de l'image",
    imageRenderFailedMessage: "Impossible de générer l'image de la question.",
    notLoggedInTitle: "Non connecté",
    notLoggedInMessage: "Connecte-toi pour voir tes messages.",
    heading: "Messages",
    noMessagesCount: "aucun message",
    newMessagesCount: (count: number) =>
      `${numberFormat.format(count)} ${pluralize(count, "nouveau", "nouveaux")}`,
    noMessagesTitle: "Aucun message",
    noMessagesBody:
      "Tu n'as pas encore de messages. Partage le lien de ta boîte de réception pour recevoir des questions anonymes.",
    addExampleMessages: "Ajouter des messages d'exemple",
    deleteConfirmTitle: "Confirmer la suppression",
    deleteConfirmMessage:
      "Es-tu sûr de vouloir supprimer ce message ? Cette action est irréversible.",
    threadReplyPosted: "Ajouté au fil.",
    responsePosted: "Ta réponse a été publiée.",
    welcomeBackTitle: "Content de te revoir !",
    welcomeBackMessage: "Tu t'es connecté avec succès.",
  },
  inboxLinkCard: {
    eyebrow: "Lien de ta boîte de réception · accès public",
  },
  postingPreferences: {
    title: "Préférences de publication",
    appendProfileLink: {
      label: "Ajouter automatiquement le lien de la boîte de réception",
      description:
        "Ajoute ton lien à chaque publication. Réduit le nombre de caractères disponibles.",
    },
    useGradients: {
      label: "Arrière-plans en dégradé",
      description: "Joli pour les captures d'écran. Désactive pour plus de contraste.",
    },
    includeQuestionAsImage: {
      label: "Question sous forme d'image",
      description: "Génère une image partageable avec un texte alternatif automatique.",
    },
    confirmBeforeDelete: {
      label: "Confirmer avant de supprimer",
      description: "Désactive si tu veux supprimer des messages en masse.",
    },
    autoScrollToMessages: {
      label: "Défilement automatique vers les messages",
      description: "Fait défiler les nouveaux messages à l'écran quand ils se chargent.",
    },
    summary: (enabled: number, total: number) =>
      `${numberFormat.format(enabled)} sur ${numberFormat.format(total)} actives`,
  },
  questionCard: {
    cannotDeleteThreadRootTooltip: "Détache d'abord le fil",
    cannotDeleteThreadRootLabel: "Impossible de supprimer la racine du fil",
    cannotDeleteWhilePostingTooltip: "Termine d'abord la publication",
    cannotDeleteWhilePostingLabel: "Impossible de supprimer pendant la publication",
    unpinThreadTooltip: "Détacher le fil",
    pinAsThreadRootTooltip: "Épingler comme racine du fil",
    unpinThreadRootLabel: "Détacher la racine du fil",
    setAsThreadRootLabel: "Définir comme racine du fil",
    deleteMessageTooltip: "Supprimer le message",
    deleteMessageLabel: "Supprimer le message",
    replyToThread: "↩ Répondre au fil",
    reply: "↩ Répondre",
    openInTooltip: "Ouvrir cette réponse dans un autre client",
    openInLabel: "Ouvrir dans un autre client",
  },

  openInPicker: {
    title: "Ouvrir dans…",
    yourDefaultHeading: "Ton client par défaut",
    recommendedHeading: "Recommandés",
    allHeading: "Tous les clients",
    openInLabel: (client: string) => `Ouvrir dans ${client}`,
    copyLinkTooltip: "Copier le lien de ce client",
    copyLinkLabel: (client: string) => `Copier le lien ${client}`,
    linkCopied: "Lien copié",
    copyFailed: "Impossible de copier le lien",
    shareUniversalLink: "Partager un lien universel",
    shareFailed: "Impossible de partager le lien",
  },
  replyComposer: {
    stillRenderingImage: "Génération de l'image de ta question en cours…",
    renderingImage: "Génération de l'image de ta question…",
    posting: "Publication…",
    stillGoingWakingRenderer: "Toujours en cours, réveil du générateur d'images…",
    stillGoing: "Toujours en cours…",
    responseAriaLabel: "Ta réponse",
    placeholder: "écris ta réponse…",
    replyToThread: "Répondre au fil",
    reply: "Répondre",
  },
  imageThemePicker: {
    title: "Thème de l'image",
  },
  themes: {
    image: {
      default: "Par défaut",
      compressed: "Compressé",
      twitter: "Style Twitter",
    },
    profileCard: {
      royal: "Royal",
      aurora: "Aurore",
      ember: "Braise",
      verdant: "Verdoyant",
    },
  },
  nav: {
    friendGroups: {
      moots: {
        label: "Mutuels",
        emptyText: (appName: string) => `Aucun mutuel sur ${appName} pour l'instant.`,
      },
      following: {
        label: "Abonnements",
        emptyText: (appName: string) =>
          `Aucun abonnement à sens unique sur ${appName} pour l'instant.`,
      },
      oomfs: {
        label: "Oomfs",
        emptyText: (appName: string) => `Aucun de tes abonnés n'est encore sur ${appName}.`,
      },
    },
    viewingProfile: "Consultation du profil",
    unreadCount: (count: number) =>
      `${numberFormat.format(count)} ${pluralize(count, "non lu", "non lus")}`,
  },
  appHeader: {
    disableAnimations: "Désactiver les animations",
    enableAnimations: "Activer les animations",
    toggleColorScheme: "Changer le thème de couleur",
  },
  customisePage: {
    heading: "Personnaliser",
    beta: "Bêta",
    yourPublicProfile: "Ton profil public",
    yourPublicProfileHelp: "Ce que les visiteurs voient avant de t'envoyer un message anonyme.",
    profilePrompt: "Phrase de profil",
    profilePromptDescription:
      "Le titre affiché au-dessus de ta zone de message. Laisse vide pour utiliser « Envoyer un message anonyme à [toi] ».",
    profilePromptPlaceholder: "Demande-moi n'importe quoi…",
    profileCardColour: "Couleur de la carte de profil",
    profileCardColourDescription:
      "Le traitement colorimétrique de ta carte de question. Les préréglages gardent le texte et les boutons lisibles quelle que soit l'option.",
    languages: "Langues",
    languagesHelp:
      "Deux publics, deux langues : celle dans laquelle tu lis l'appli, et celle que lisent tes visiteurs.",
    appLanguage: "Langue de l'appli",
    appLanguageDescription:
      "La langue dans laquelle tu lis l'appli : navigation, boutons et notifications. Toi seul la vois.",
    messageLanguage: "Langue des messages",
    messageLanguageDescription:
      "Langue de la phrase, du texte de partage et de l'avertissement d'anonymat vus par les visiteurs et ton public. Ta phrase de profil personnalisée prime sur ce réglage.",
    messageIntake: "Réception des messages",
    messageIntakeHelp: "Qui peut atteindre ta boîte de réception, et ce qui passe.",
    inbox: "Boîte de réception",
    inboxDescription:
      "Désactive pour arrêter de recevoir de nouveaux messages tout en gardant ton compte, ton historique et tes réglages intacts. Les visiteurs verront un statut « n'accepte pas de messages ».",
    profanityFilter: "Filtre de grossièretés",
    profanityFilterDescription:
      "Une fois activé, les messages entrants sont filtrés à l'aide de listes de mots en anglais, espagnol, portugais, allemand et français - chaque message est vérifié dans les cinq langues, quelle que soit la langue que tu as choisie dans l'appli. Les messages signalés sont discrètement écartés - l'expéditeur voit une réponse de succès, mais le message n'atteint jamais ta boîte de réception.",
    atmosphereLinks: "Liens Atmosphere",
    atmosphereLinksHelp: "Vers où mènent les liens vers les publications et les profils.",
    defaultClient: "Client préféré",
    defaultClientDescription:
      "Quel client Atmosphere ouvre les publications et les profils que tu suis depuis ici.",
    openProfilesInApp: (appName) => `Ouvrir les profils dans ${appName}`,
    openProfilesInAppDescription: (appName) =>
      `Quand c'est activé, une @mention dans une bio ouvre le profil ${appName} de cette personne. Sinon, elle s'ouvre dans ton client préféré.`,
  },
  publicProfilePage: {
    messageEmptyError: "Le message ne peut pas être vide.",
    recipientNotFoundTitle: "Erreur",
    recipientNotFoundMessage: "Impossible d'envoyer le message : DID de l'utilisateur introuvable.",
    messageSentTitle: "Message envoyé !",
    messageSentBody: "Ton message anonyme est en route.",
    sendFailedTitle: "Échec de l'envoi",
    noBlueskyAccountTitle: "Aucun compte Bluesky trouvé",
    noBlueskyAccountBody: "n'existe pas sur Bluesky. Vérifie le nom d'utilisateur et réessaie.",
    notOnAppTitle: (appName: string) => `Pas sur ${appName}`,
    notOnAppBodyPrefix:
      "a un compte Bluesky, mais n'a pas encore configuré sa boîte de réception sur ",
    notOnAppBodySuffix: ".",
    profileLoadFailed: "Impossible de charger les informations du profil.",
    confirmSendTitle: "Confirmer le message anonyme",
    confirmSendMessage:
      "Es-tu sûr de vouloir envoyer ce message anonyme ? Cette action est irréversible.",
    sendMessage: "Envoyer le message",
    handleResolveFailed: "Impossible de résoudre le nom d'utilisateur. Il n'existe peut-être pas.",
    sendMessageFailed: "Impossible d'envoyer le message. Réessaie.",
  },
  askCard: {
    clearMessage: "Effacer le message",
  },
  profileCard: {
    viewOn: (client) => `Voir sur ${client}`,
  },
  profileUrlBar: {
    shareFailedTitle: "Échec du partage",
    shareFailedMessage: "Impossible de partager le lien.",
    copyProfileLinkAriaLabel: "Copier le lien du profil",
    shareProfileLinkAriaLabel: "Partager le lien du profil",
  },
  loginPage: {
    handleRequired: "Le nom d'utilisateur est requis",
    handleTooLong: "Nom d'utilisateur trop long",
    oauthFailedMessage: "Échec de la connexion. Réessaie.",
    logInToPrefix: "Se connecter à ",
    subtitle: "Entre ton identifiant AT Protocol pour continuer",
    atmosphereHandle: "Identifiant Atmosphere",
    handlePlaceholder: "ex. tonpseudo.bsky.social",
    continueButton: "Continuer",
    disclaimerPrefix: "Tu seras redirigé vers Bluesky pour t'authentifier. ",
    disclaimerMiddle: " n'a pas accès à ton mot de passe. Vérifie que tu vois ",
    disclaimerSuffix: " sur la page de connexion.",
  },
  handleSuggestions: {
    ariaLabel: "Suggestions d'utilisateurs",
    noHandlesFound: "Aucun utilisateur trouvé",
    startTyping: "Commence à taper pour voir des suggestions d'utilisateurs",
  },
  e2eLoginPanel: {
    modeNotice: "Mode de test E2E - ne pas utiliser en production",
    identifier: "Identifiant",
    identifierPlaceholder: "utilisateur.pds.example",
    appPassword: "Mot de passe d'application",
    appPasswordPlaceholder: "xxxx-xxxx-xxxx-xxxx",
    signIn: "Se connecter (E2E)",
  },
  oauthCallback: {
    missingToken: "Token OAuth manquant dans l'URL de retour.",
    loggingIn: "Connexion en cours…",
    completingAuth: "Finalisation de ton authentification Bluesky",
    loginFailed: "Échec de la connexion",
    tryAgain: "Réessayer",
    redirectNotice: "Tu seras redirigé automatiquement une fois la connexion terminée.",
  },
  pushNotificationsCard: {
    description:
      "Reçois une notification push à l'arrivée d'un message. Accepte l'invite de ton navigateur pour l'activer ; effacer les données du site la désactive. Couvre tous les comptes connectés sur cet appareil.",
    serverUnavailable: "Les notifications push ne sont pas configurées sur ce serveur.",
    browserUnsupported: "Ce navigateur ne peut pas recevoir de notifications push.",
    browserBlocked:
      "Bloquées dans les paramètres de ton navigateur. Réautorise les notifications pour ce site pour les activer.",
    toastTitle: "Notifications push",
    title: "Notifications push",
  },
  shareButton: {
    linkCopiedTitle: "Copié !",
    linkCopiedMessage: "Lien copié dans le presse-papiers.",
    copyFailedTitle: "Échec de la copie",
    copyFailedMessage: "Impossible de copier le lien dans le presse-papiers.",
    sharingUnavailableTitle: "Partage indisponible",
    sharingUnavailableMessage: "Le partage n'est pas pris en charge sur ce navigateur.",
    button: "Partager",
  },
  questionRender: {
    renderLost: "Impossible de générer l'image de la question. Essaie de l'envoyer à nouveau.",
    renderUnreachable:
      "Impossible de vérifier l'image de la question. Essaie de l'envoyer à nouveau.",
  },
  notificationService: {
    serverUnavailable: "Les notifications push ne sont pas disponibles sur ce serveur",
    browserUnsupported: "Les notifications push ne sont pas prises en charge par ce navigateur",
    permissionDenied: "La permission de notification n'a pas été accordée",
    subscriptionMissingEndpoint: "L'abonnement push n'a retourné aucun endpoint",
  },
  updateAvailableButton: {
    ariaLabel: "Mise à jour disponible — recharge pour l'appliquer",
    buttonLabel: "Mettre à jour",
    applyingAriaLabel: "Application de la mise à jour — la page va être rechargée",
    applyingLabel: "Mise à jour…",
  },
  userMenu: {
    switchAccountErrorTitle: "Impossible de changer de compte",
    userAvatarAltFallback: "Avatar de l'utilisateur",
    accountsLabel: "Comptes",
    addAccount: "Ajouter un compte",
    viewProfile: "Voir le profil",
    logOut: (handle: string | undefined) => `Se déconnecter @${handle}`,
  },
  home: {
    titleSuffix: " - Questions et réponses anonymes sur Bluesky",
    subtitle: "Reçois des questions depuis le web et publie les réponses directement sur Bluesky.",
    sellingPoints: {
      fastAndFree: {
        title: "Rapide et gratuit",
        body: "Aucun téléchargement requis, connecte-toi simplement avec tes identifiants Bluesky et partage le lien de ta boîte de réception",
      },
      spamProtection: {
        title: "Protection anti-spam, sans captchas",
        body: "Protégé par Anubis, un puissant service de détection de bots",
      },
      openSource: {
        title: "Open source",
        body: "Contribue directement au projet, ou héberge ta propre version si tu veux !",
      },
    },
    questionsFeedback: "Des questions ? Des retours ?",
    reachOutOnBluesky: "Contacte-nous sur Bluesky",
    submitAnIssueOnGitHub: "Soumettre un ticket sur GitHub",
    githubContactLabel: "GitHub - ",
    disclaimer:
      "Avertissement : merci de respecter les conditions d'utilisation de Bluesky. Des cookies sont utilisés pour te garder connecté. Cette appli n'inclut aucune modération.",
    welcomeBackGreetingPrefix: "Ravi de te revoir,",
    viewYourMessages: "Voir tes messages",
    copyProfileLink: "Copier le lien du profil",
    copyLinkButton: "Copier le lien",
    getStarted: "Commencer",
    shareTitle: (appName: string) => `Envoie-moi des messages anonymes sur ${appName} !`,
  },
  settingsPage: {
    heading: "Paramètres",
    accountOverview: "Aperçu du compte",
    updateFailedTitle: "Échec de la mise à jour",
    pdsSync: "Synchronisation PDS",
    messagesInInbox: "Messages dans la boîte de réception",
    answersOnPds: "Réponses sur le PDS",
    activeSince: "Actif depuis",
    pdsLabel: "PDS",
    installApplication: "Installer l'application",
    installApplicationDescription:
      "Installe l'appli pour un accès plus rapide sur n'importe quel appareil : téléphone, tablette ou ordinateur portable. Elle fonctionne dans le même navigateur, et tu peux la désinstaller à tout moment.",
    install: "Installer ",
    openFeedOnBluesky: "Ouvrir le flux sur Bluesky",
    dailyNotifications: "Notifications quotidiennes",
    viewBotOnBluesky: "Voir le bot sur Bluesky",
    followTheBotOnBluesky: "Suivre le bot sur Bluesky",
    deleteMyData: "Supprimer mes données",
    deleteAccountTitle: "Supprimer le compte",
    deleteAccountMessage:
      "Es-tu sûr de vouloir supprimer ton compte et toutes tes données ? Cette action est irréversible.",
    pdsSyncDescription: (appName: string) =>
      `${appName} synchronise tes messages anonymes avec ton PDS Bluesky (serveur de données personnel). Désactive ceci pour les garder uniquement sur les serveurs de ${appName}. La publication sur Bluesky n'est pas affectée.`,
    feedTitle: (appName: string) => `Flux ${appName}`,
    feedDescription: (appName: string) =>
      `Parcours les questions et réponses anonymes publiées par tout le monde sur ${appName} à travers le monde. Ce flux peut contenir du contenu réservé aux adultes. Consulte-le à tes propres risques.`,
    dailyNotificationsDescription: (appName: string) =>
      `Suis le bot de notifications ${appName} sur Bluesky pour recevoir une alerte quotidienne quand tu as de nouveaux messages dans ta boîte de réception.`,
    deleteMyDataDescription: (appName: string) =>
      `Supprime définitivement toutes tes données des serveurs de ${appName} et du PDS Bluesky. Cela désactive aussi ta boîte de réception, donc tu ne recevras plus de messages. Tu peux toujours te reconnecter pour te réinscrire automatiquement.`,
  },
  errors: {
    codes: {
      NOT_AUTHENTICATED: "Tu n'es pas connecté. Connecte-toi et réessaie.",
      SESSION_EXPIRED: "Ta session a expiré. Reconnecte-toi.",
      ACCOUNT_SESSION_EXPIRED: "La session de ce compte a expiré. Reconnecte-toi.",
      AGENT_INIT_FAILED: "Nous n'avons pas pu vérifier ta session. Reconnecte-toi.",
      INVALID_HANDLE: "Cela ne ressemble pas à un nom d'utilisateur Bluesky valide.",
      INVALID_DID: "Cet identifiant de compte n'est pas valide.",
      DID_REQUIRED: "Un identifiant de compte est requis.",
      RECIPIENT_DID_REQUIRED: "Un destinataire est requis.",
      MESSAGE_TID_REQUIRED: "Un identifiant de message est requis.",
      HANDLE_NOT_FOUND: "Nous n'avons pas trouvé ce nom d'utilisateur.",
      USER_NOT_FOUND: "Nous n'avons pas trouvé cet utilisateur.",
      PROFILE_NOT_FOUND: "Nous n'avons pas trouvé ce profil.",
      MISSING_OAUTH_TOKEN: "Il manque un token requis à ton lien de connexion.",
      INVALID_OAUTH_TOKEN: "Ton lien de connexion a expiré ou est invalide.",
      SERVER_MISCONFIGURED: "Le serveur est mal configuré. Réessaie plus tard.",
      LOGOUT_FAILED: "Nous n'avons pas pu te déconnecter. Réessaie.",
      ACCOUNT_SWITCH_FAILED: "Nous n'avons pas pu changer de compte. Réessaie.",
      EXAMPLE_MESSAGES_FAILED: "Nous n'avons pas pu ajouter de messages d'exemple. Réessaie.",
      MESSAGES_FETCH_FAILED: "Nous n'avons pas pu charger tes messages. Réessaie.",
      PDS_SYNC_FAILED: "Nous n'avons pas pu synchroniser tes messages. Réessaie.",
      PROFILE_FETCH_FAILED: "Nous n'avons pas pu charger ce profil. Réessaie.",
      USER_EXISTENCE_CHECK_FAILED: "Nous n'avons pas pu vérifier cet utilisateur pour le moment.",
      FRIENDS_FETCH_FAILED: "Nous n'avons pas pu charger tes amis. Réessaie.",
      BOT_FOLLOW_CHECK_FAILED: "Nous n'avons pas pu vérifier si tu suis le bot.",
      PDS_RESOLVE_FAILED: "Nous n'avons pas pu résoudre le serveur de ce nom d'utilisateur.",
      HANDLE_SEARCH_FAILED: "Nous n'avons pas pu rechercher de noms d'utilisateur pour le moment.",
      HANDLE_RESOLVE_FAILED: "Nous n'avons pas pu résoudre ce nom d'utilisateur.",
      SETTINGS_FETCH_FAILED: "Nous n'avons pas pu charger tes paramètres. Réessaie.",
      SETTINGS_UPDATE_FAILED: "Nous n'avons pas pu enregistrer tes paramètres. Réessaie.",
      STATS_FETCH_FAILED: "Nous n'avons pas pu charger tes statistiques. Réessaie.",
      PDS_INFO_FETCH_FAILED: "Nous n'avons pas pu charger les informations de ton PDS. Réessaie.",
      PUSH_NOT_CONFIGURED: "Les notifications push ne sont pas disponibles sur ce serveur.",
      PUSH_SUBSCRIBE_FAILED: "Nous n'avons pas pu activer les notifications push. Réessaie.",
      PUSH_UNSUBSCRIBE_FAILED: "Nous n'avons pas pu désactiver les notifications push. Réessaie.",
      INBOX_CLOSED:
        "Cette boîte de réception est fermée et n'accepte pas de nouveaux messages pour le moment.",
      MESSAGE_SEND_FAILED: "Nous n'avons pas pu envoyer ton message. Réessaie.",
      MESSAGE_NOT_FOUND: "Nous n'avons pas trouvé ce message.",
      MESSAGE_DELETE_NOT_AUTHORIZED: "Ce message ne t'appartient pas, tu ne peux pas le supprimer.",
      MESSAGE_DELETE_FAILED: "Nous n'avons pas pu supprimer ce message. Réessaie.",
      BLUESKY_POST_FAILED: "Nous n'avons pas pu publier ta réponse sur Bluesky. Réessaie.",
      ACCOUNT_DELETE_FAILED: "Nous n'avons pas pu supprimer les données de ton compte. Réessaie.",
      RENDER_QUESTION_NOT_IN_INBOX: "Cette question n'est plus dans ta boîte de réception.",
      RENDER_START_FAILED: "Nous n'avons pas pu générer l'image. Réessaie.",
      LOGIN_INIT_FAILED: "Nous n'avons pas pu démarrer la connexion. Réessaie.",
      E2E_LOGIN_UNAVAILABLE: "La connexion de test n'est pas disponible ici.",
      E2E_LOGIN_NO_DID: "Échec de la connexion. Réessaie.",
    },
    generic: "Une erreur s'est produite. Réessaie.",
  },
  notFoundPage: {
    title: "404 - Introuvable",
    message: "La ressource demandée est introuvable.",
  },
} satisfies Messages;
