import type { Messages } from "./types";

const numberFormat = new Intl.NumberFormat("es");

/**
 * Spanish adjectives agree in number with the noun they modify, unlike
 * English's bare "new"/"unread" — `pluralRules.select(count)` returns "one"
 * only for exactly 1 (and, per CLDR, for some fractional forms this codebase
 * never passes it), so every other count — including 0 — takes the plural
 * form.
 */
const pluralRules = new Intl.PluralRules("es");

function pluralize(count: number, singular: string, plural: string): string {
  return pluralRules.select(count) === "one" ? singular : plural;
}

export const es = {
  common: {
    cancel: "Cancelar",
    confirm: "Confirmar",
    delete: "Eliminar",
    retry: "Reintentar",
    copy: "Copiar",
    copied: "¡Copiado!",
    copyLink: "Copiar enlace",
    share: "Compartir",
    userAltFallback: "Usuario",
    respondToThreadRootFirst: "Responde primero al mensaje raíz del hilo",
    errorTitle: "Error",
    accessDeniedMessage: "No puedes acceder a esta página sin iniciar sesión.",
    settingsLoadErrorTitle: "No se pudo cargar la configuración",
    switchedToAccount: (handle: string) => `Cambiaste a @${handle}`,
    shortcuts: {
      title: "Atajos de teclado",
      home: "Inicio",
      login: "Iniciar sesión",
      messages: "Mensajes",
      settings: "Configuración",
      customise: "Personalizar",
      focusCycleCards: "Enfocar / recorrer tarjetas",
      navigateCards: "Navegar entre tarjetas",
      closeExpandedCard: "Cerrar tarjeta expandida",
    },
  },
  messagesPage: {
    themeUpdateErrorTitle: "Error al actualizar el tema",
    addExamplesErrorTitle: "Error al añadir ejemplos",
    deleteErrorTitle: "Error al eliminar el mensaje",
    threadReplyTitle: "¡Añadido al hilo!",
    responseSentTitle: "¡Respuesta enviada!",
    responseErrorTitle: "Error al responder",
    emptyResponseTitle: "Respuesta vacía",
    emptyResponseMessage: "La respuesta no puede estar vacía.",
    imageRenderFailedTitle: "Error al generar la imagen",
    imageRenderFailedMessage: "No se pudo generar la imagen de la pregunta.",
    notLoggedInTitle: "No has iniciado sesión",
    notLoggedInMessage: "Inicia sesión para ver tus mensajes.",
    heading: "Mensajes",
    noMessagesCount: "sin mensajes",
    newMessagesCount: (count: number) =>
      `${numberFormat.format(count)} ${pluralize(count, "nuevo", "nuevos")}`,
    noMessagesTitle: "Sin mensajes",
    noMessagesBody:
      "Todavía no tienes mensajes. Comparte el enlace de tu bandeja para recibir preguntas anónimas.",
    addExampleMessages: "Añadir mensajes de ejemplo",
    deleteConfirmTitle: "Confirmar eliminación",
    deleteConfirmMessage:
      "¿Seguro que quieres eliminar este mensaje? Esta acción no se puede deshacer.",
    threadReplyPosted: "Añadido al hilo.",
    responsePosted: "Tu respuesta se ha publicado.",
    welcomeBackTitle: "¡Bienvenido de nuevo!",
    welcomeBackMessage: "Has iniciado sesión correctamente.",
  },
  inboxLinkCard: {
    eyebrow: "Enlace de tu bandeja · acceso público",
  },
  postingPreferences: {
    title: "Preferencias de publicación",
    appendProfileLink: {
      label: "Añadir enlace de bandeja automáticamente",
      description: "Añade tu enlace a cada publicación. Reduce el límite de caracteres.",
    },
    useGradients: {
      label: "Fondos degradados",
      description: "Bonitos para capturas de pantalla. Desactívalo para más contraste.",
    },
    includeQuestionAsImage: {
      label: "Pregunta como imagen",
      description: "Genera una imagen compartible con texto alternativo automático.",
    },
    confirmBeforeDelete: {
      label: "Confirmar antes de eliminar",
      description: "Desactívalo si quieres eliminar mensajes en bloque.",
    },
    autoScrollToMessages: {
      label: "Desplazamiento automático a mensajes",
      description: "Desplaza los mensajes nuevos a la vista cuando se cargan.",
    },
    summary: (enabled: number, total: number) =>
      `${numberFormat.format(enabled)} de ${numberFormat.format(total)} activas`,
  },
  questionCard: {
    cannotDeleteThreadRootTooltip: "Desancla el hilo primero",
    cannotDeleteThreadRootLabel: "No se puede eliminar la raíz del hilo",
    cannotDeleteWhilePostingTooltip: "Termina de publicar primero",
    cannotDeleteWhilePostingLabel: "No se puede eliminar mientras se publica",
    unpinThreadTooltip: "Desanclar hilo",
    pinAsThreadRootTooltip: "Anclar como raíz del hilo",
    unpinThreadRootLabel: "Desanclar raíz del hilo",
    setAsThreadRootLabel: "Establecer como raíz del hilo",
    deleteMessageTooltip: "Eliminar mensaje",
    deleteMessageLabel: "Eliminar mensaje",
    replyToThread: "↩ Responder al hilo",
    reply: "↩ Responder",
    openInTooltip: "Abrir esta respuesta en otro cliente",
    openInLabel: "Abrir en otro cliente",
  },

  openInPicker: {
    title: "Abrir en…",
    yourDefaultHeading: "Tu predeterminado",
    recommendedHeading: "Recomendados",
    allHeading: "Todos los clientes",
    openInLabel: (client: string) => `Abrir en ${client}`,
    copyLinkTooltip: "Copiar el enlace de este cliente",
    copyLinkLabel: (client: string) => `Copiar el enlace de ${client}`,
    linkCopied: "Enlace copiado",
    copyFailed: "No se pudo copiar el enlace",
    shareUniversalLink: "Compartir un enlace universal",
    shareFailed: "No se pudo compartir el enlace",
  },
  replyComposer: {
    stillRenderingImage: "Todavía generando la imagen de tu pregunta…",
    renderingImage: "Generando la imagen de tu pregunta…",
    posting: "Publicando…",
    stillGoingWakingRenderer: "Sigue en proceso, despertando el generador de imágenes…",
    stillGoing: "Sigue en proceso…",
    responseAriaLabel: "Tu respuesta",
    placeholder: "escribe tu respuesta…",
    replyToThread: "Responder al hilo",
    reply: "Responder",
  },
  imageThemePicker: {
    title: "Tema de imagen",
  },
  themes: {
    image: {
      default: "Predeterminado",
      compressed: "Comprimido",
      twitter: "Estilo Twitter",
    },
    profileCard: {
      royal: "Real",
      aurora: "Aurora",
      ember: "Ascua",
      verdant: "Frondoso",
    },
  },
  nav: {
    friendGroups: {
      moots: {
        label: "Amigos mutuos",
        emptyText: (appName: string) => `Todavía no tienes amigos mutuos en ${appName}.`,
      },
      following: {
        label: "Siguiendo",
        emptyText: (appName: string) =>
          `Todavía no tienes seguidos unidireccionales en ${appName}.`,
      },
      oomfs: {
        label: "Oomfs",
        emptyText: (appName: string) => `Ninguno de tus seguidores está en ${appName} todavía.`,
      },
    },
    viewingProfile: "Viendo perfil",
    unreadCount: (count: number) =>
      `${numberFormat.format(count)} ${pluralize(count, "no leído", "no leídos")}`,
  },
  appHeader: {
    disableAnimations: "Desactivar animaciones",
    enableAnimations: "Activar animaciones",
    toggleColorScheme: "Cambiar esquema de color",
  },
  customisePage: {
    heading: "Personalizar",
    beta: "Beta",
    yourPublicProfile: "Tu perfil público",
    yourPublicProfileHelp: "Lo que ven los visitantes antes de enviarte un mensaje anónimo.",
    profilePrompt: "Frase de tu perfil",
    profilePromptDescription:
      "El titular que se muestra encima de tu caja de mensajes. Déjalo en blanco para usar «Envía a [ti] un mensaje anónimo».",
    profilePromptPlaceholder: "Pregúntame lo que quieras…",
    profileCardColour: "Color de la tarjeta de perfil",
    profileCardColourDescription:
      "El tratamiento de color de tu tarjeta de preguntas. Los ajustes predefinidos mantienen el texto y los botones legibles en todas las opciones.",
    languages: "Idiomas",
    languagesHelp:
      "Dos públicos, dos idiomas: el que usas para leer la app y el que leen tus visitantes.",
    appLanguage: "Idioma de la app",
    appLanguageDescription:
      "El idioma en el que lees la app: navegación, botones y notificaciones. Solo tú lo ves.",
    messageLanguage: "Idioma de los mensajes",
    messageLanguageDescription:
      "Idioma del mensaje, el texto para compartir y el aviso de anonimato que ven los visitantes y tu público. Tu frase de perfil personalizada tiene prioridad sobre este ajuste.",
    messageIntake: "Recepción de mensajes",
    messageIntakeHelp: "Quién puede llegar a tu bandeja y qué se deja pasar.",
    inbox: "Bandeja de entrada",
    inboxDescription:
      "Desactívala para dejar de recibir mensajes nuevos sin perder tu cuenta, historial ni configuración. Los visitantes verán un estado de «no acepta mensajes».",
    profanityFilter: "Filtro de lenguaje ofensivo",
    profanityFilterDescription:
      "Cuando está activado, los mensajes entrantes se filtran con listas de palabras en inglés, español, portugués, alemán y francés - cada mensaje se comprueba en los cinco idiomas, sea cual sea el idioma que tengas configurado en la app. Los mensajes marcados se descartan en silencio - quien lo envía ve una respuesta de éxito, pero el mensaje nunca llega a tu bandeja.",
    atmosphereLinks: "Enlaces de Atmosphere",
    atmosphereLinksHelp: "Adónde te llevan los enlaces a publicaciones y perfiles.",
    defaultClient: "Cliente preferido",
    defaultClientDescription:
      "Qué cliente de Atmosphere abre las publicaciones y los perfiles que sigues desde aquí.",
    openProfilesInApp: (appName) => `Abrir los perfiles en ${appName}`,
    openProfilesInAppDescription: (appName) =>
      `Cuando está activo, una @mención en una biografía abre el perfil de esa persona en ${appName}. Cuando no, se abre en tu cliente preferido.`,
  },
  publicProfilePage: {
    messageEmptyError: "El mensaje no puede estar vacío.",
    recipientNotFoundTitle: "Error",
    recipientNotFoundMessage: "No se puede enviar el mensaje: no se encontró el DID del usuario.",
    messageSentTitle: "¡Mensaje enviado!",
    messageSentBody: "Tu mensaje anónimo está en camino.",
    sendFailedTitle: "Error al enviar",
    noBlueskyAccountTitle: "No se encontró ninguna cuenta de Bluesky",
    noBlueskyAccountBody: "no existe en Bluesky. Verifica el usuario e inténtalo de nuevo.",
    notOnAppTitle: (appName: string) => `No está en ${appName}`,
    notOnAppBodyPrefix: "tiene una cuenta de Bluesky, pero todavía no configuró su bandeja en ",
    notOnAppBodySuffix: ".",
    profileLoadFailed: "No se pudo cargar la información del perfil.",
    confirmSendTitle: "Confirmar mensaje anónimo",
    confirmSendMessage:
      "¿Seguro que quieres enviar este mensaje anónimo? Esta acción no se puede deshacer.",
    sendMessage: "Enviar mensaje",
    handleResolveFailed: "No se pudo resolver el usuario. Puede que no exista.",
    sendMessageFailed: "No se pudo enviar el mensaje. Inténtalo de nuevo.",
  },
  askCard: {
    clearMessage: "Borrar mensaje",
  },
  profileCard: {
    viewOn: (client) => `Ver en ${client}`,
  },
  profileUrlBar: {
    shareFailedTitle: "Error al compartir",
    shareFailedMessage: "No se pudo compartir el enlace.",
    copyProfileLinkAriaLabel: "Copiar enlace de perfil",
    shareProfileLinkAriaLabel: "Compartir enlace de perfil",
  },
  loginPage: {
    handleRequired: "El usuario es obligatorio",
    handleTooLong: "El usuario es demasiado largo",
    oauthFailedMessage: "Error al iniciar sesión. Inténtalo de nuevo.",
    logInToPrefix: "Iniciar sesión en ",
    subtitle: "Ingresa tu usuario de AT Protocol para continuar",
    atmosphereHandle: "Usuario de Atmosphere",
    handlePlaceholder: "p. ej. tuusuario.bsky.social",
    continueButton: "Continuar",
    disclaimerPrefix: "Serás redirigido a Bluesky para autenticarte. ",
    disclaimerMiddle: " no tiene acceso a tu contraseña. Verifica que veas ",
    disclaimerSuffix: " en la página de inicio de sesión.",
  },
  handleSuggestions: {
    ariaLabel: "Sugerencias de usuario",
    noHandlesFound: "No se encontraron usuarios",
    startTyping: "Empieza a escribir para ver sugerencias de usuario",
  },
  e2eLoginPanel: {
    modeNotice: "Modo de prueba E2E - no usar en producción",
    identifier: "Identificador",
    identifierPlaceholder: "usuario.pds.example",
    appPassword: "Contraseña de aplicación",
    appPasswordPlaceholder: "xxxx-xxxx-xxxx-xxxx",
    signIn: "Iniciar sesión (E2E)",
  },
  oauthCallback: {
    missingToken: "Falta el token de OAuth en la URL de retorno.",
    loggingIn: "Iniciando sesión…",
    completingAuth: "Completando tu autenticación de Bluesky",
    loginFailed: "Error al iniciar sesión",
    tryAgain: "Intentar de nuevo",
    redirectNotice: "Serás redirigido automáticamente cuando termine el inicio de sesión.",
  },
  pushNotificationsCard: {
    description:
      "Recibe una notificación push cuando llegue un mensaje. Acepta el aviso del navegador para activarla; borrar los datos del sitio la desactiva. Cubre todas las cuentas con sesión iniciada en este dispositivo.",
    serverUnavailable: "Las notificaciones push no están configuradas en este servidor.",
    browserUnsupported: "Este navegador no puede recibir notificaciones push.",
    browserBlocked:
      "Bloqueadas en la configuración de tu navegador. Vuelve a permitir las notificaciones para este sitio para activarlas.",
    toastTitle: "Notificaciones push",
    title: "Notificaciones push",
  },
  shareButton: {
    linkCopiedTitle: "¡Copiado!",
    linkCopiedMessage: "Enlace copiado al portapapeles.",
    copyFailedTitle: "Error al copiar",
    copyFailedMessage: "No se pudo copiar el enlace al portapapeles.",
    sharingUnavailableTitle: "Compartir no disponible",
    sharingUnavailableMessage: "Este navegador no admite la función de compartir.",
    button: "Compartir",
  },
  questionRender: {
    renderLost: "No se pudo generar la imagen de la pregunta. Intenta enviarla de nuevo.",
    renderUnreachable: "No se pudo comprobar la imagen de la pregunta. Intenta enviarla de nuevo.",
  },
  notificationService: {
    serverUnavailable: "Las notificaciones push no están disponibles en este servidor",
    browserUnsupported: "Este navegador no admite notificaciones push",
    permissionDenied: "No se concedió el permiso de notificaciones",
    subscriptionMissingEndpoint: "La suscripción push no devolvió ningún endpoint",
  },
  updateAvailableButton: {
    ariaLabel: "Actualización disponible — recarga para aplicarla",
    buttonLabel: "Actualizar",
    applyingAriaLabel: "Aplicando la actualización — la página se recargará",
    applyingLabel: "Actualizando…",
  },
  userMenu: {
    switchAccountErrorTitle: "No se pudo cambiar de cuenta",
    userAvatarAltFallback: "Avatar de usuario",
    accountsLabel: "Cuentas",
    addAccount: "Añadir cuenta",
    viewProfile: "Ver perfil",
    logOut: (handle: string | undefined) => `Cerrar sesión @${handle}`,
  },
  home: {
    titleSuffix: " - Preguntas y respuestas anónimas en Bluesky",
    subtitle: "Recibe preguntas desde la web y publica las respuestas directamente en Bluesky.",
    sellingPoints: {
      fastAndFree: {
        title: "Rápido y gratis",
        body: "No necesitas descargar nada, solo inicia sesión con tus credenciales de Bluesky y comparte el enlace de tu bandeja",
      },
      spamProtection: {
        title: "Protección contra spam, sin captchas",
        body: "Protegido por Anubis, un potente servicio de detección de bots",
      },
      openSource: {
        title: "Código abierto",
        body: "Contribuye directamente al proyecto, ¡o aloja tu propia versión si quieres!",
      },
    },
    questionsFeedback: "¿Preguntas? ¿Comentarios?",
    reachOutOnBluesky: "Contáctanos en Bluesky",
    submitAnIssueOnGitHub: "Envía un issue en GitHub",
    githubContactLabel: "GitHub - ",
    disclaimer:
      "Aviso: sigue las condiciones de servicio de Bluesky. Se usan cookies para mantener tu sesión iniciada. Esta app no incluye moderación.",
    welcomeBackGreetingPrefix: "Qué bueno verte de nuevo,",
    viewYourMessages: "Ver tus mensajes",
    copyProfileLink: "Copiar enlace de perfil",
    copyLinkButton: "Copiar enlace",
    getStarted: "Empezar",
    shareTitle: (appName: string) => `¡Envíame mensajes anónimos en ${appName}!`,
  },
  settingsPage: {
    heading: "Configuración",
    accountOverview: "Resumen de la cuenta",
    updateFailedTitle: "Error al actualizar",
    pdsSync: "Sincronización con el PDS",
    messagesInInbox: "Mensajes en la bandeja",
    answersOnPds: "Respuestas en el PDS",
    activeSince: "Activo desde",
    pdsLabel: "PDS",
    installApplication: "Instalar aplicación",
    installApplicationDescription:
      "Instala la app para acceder más rápido desde cualquier dispositivo: móvil, tablet u ordenador. Funciona en el mismo navegador y puedes desinstalarla cuando quieras.",
    install: "Instalar ",
    openFeedOnBluesky: "Abrir feed en Bluesky",
    dailyNotifications: "Notificaciones diarias",
    viewBotOnBluesky: "Ver el bot en Bluesky",
    followTheBotOnBluesky: "Seguir al bot en Bluesky",
    deleteMyData: "Eliminar mis datos",
    deleteAccountTitle: "Eliminar cuenta",
    deleteAccountMessage:
      "¿Seguro que quieres eliminar tu cuenta y todos tus datos? Esta acción no se puede deshacer.",
    pdsSyncDescription: (appName: string) =>
      `${appName} sincroniza tus mensajes anónimos con tu PDS de Bluesky (servidor de datos personal). Desactiva esto para mantenerlos solo en los servidores de ${appName}. Publicar en Bluesky no se ve afectado.`,
    feedTitle: (appName: string) => `Feed de ${appName}`,
    feedDescription: (appName: string) =>
      `Explora preguntas y respuestas anónimas publicadas por todo el mundo en ${appName}. Este feed puede contener contenido para adultos. Míralo bajo tu propia responsabilidad.`,
    dailyNotificationsDescription: (appName: string) =>
      `Sigue al bot de notificaciones de ${appName} en Bluesky para recibir una alerta diaria cuando tengas mensajes nuevos en tu bandeja.`,
    deleteMyDataDescription: (appName: string) =>
      `Elimina permanentemente todos tus datos de los servidores de ${appName} y del PDS de Bluesky. Esto también desactiva tu bandeja, así que dejarás de recibir mensajes. Siempre puedes volver a iniciar sesión para registrarte de nuevo automáticamente.`,
  },
  errors: {
    codes: {
      NOT_AUTHENTICATED: "No has iniciado sesión. Inicia sesión e inténtalo de nuevo.",
      SESSION_EXPIRED: "Tu sesión ha expirado. Inicia sesión de nuevo.",
      ACCOUNT_SESSION_EXPIRED: "La sesión de esa cuenta ha expirado. Inicia sesión de nuevo.",
      AGENT_INIT_FAILED: "No pudimos verificar tu sesión. Inicia sesión de nuevo.",
      INVALID_HANDLE: "Eso no parece un usuario de Bluesky válido.",
      INVALID_DID: "Ese identificador de cuenta no es válido.",
      DID_REQUIRED: "Se requiere un identificador de cuenta.",
      RECIPIENT_DID_REQUIRED: "Se requiere un destinatario.",
      MESSAGE_TID_REQUIRED: "Se requiere un identificador de mensaje.",
      HANDLE_NOT_FOUND: "No pudimos encontrar ese usuario.",
      USER_NOT_FOUND: "No pudimos encontrar a ese usuario.",
      PROFILE_NOT_FOUND: "No pudimos encontrar ese perfil.",
      MISSING_OAUTH_TOKEN: "A tu enlace de inicio de sesión le falta un token obligatorio.",
      INVALID_OAUTH_TOKEN: "Tu enlace de inicio de sesión expiró o no es válido.",
      SERVER_MISCONFIGURED: "El servidor está mal configurado. Inténtalo de nuevo más tarde.",
      LOGOUT_FAILED: "No pudimos cerrar tu sesión. Inténtalo de nuevo.",
      ACCOUNT_SWITCH_FAILED: "No pudimos cambiar de cuenta. Inténtalo de nuevo.",
      EXAMPLE_MESSAGES_FAILED: "No pudimos añadir mensajes de ejemplo. Inténtalo de nuevo.",
      MESSAGES_FETCH_FAILED: "No pudimos cargar tus mensajes. Inténtalo de nuevo.",
      PDS_SYNC_FAILED: "No pudimos sincronizar tus mensajes. Inténtalo de nuevo.",
      PROFILE_FETCH_FAILED: "No pudimos cargar ese perfil. Inténtalo de nuevo.",
      USER_EXISTENCE_CHECK_FAILED: "No pudimos verificar ese usuario en este momento.",
      FRIENDS_FETCH_FAILED: "No pudimos cargar tus amigos. Inténtalo de nuevo.",
      BOT_FOLLOW_CHECK_FAILED: "No pudimos verificar si sigues al bot.",
      PDS_RESOLVE_FAILED: "No pudimos resolver el servidor de ese usuario.",
      HANDLE_SEARCH_FAILED: "No pudimos buscar usuarios en este momento.",
      HANDLE_RESOLVE_FAILED: "No pudimos resolver ese usuario.",
      SETTINGS_FETCH_FAILED: "No pudimos cargar tu configuración. Inténtalo de nuevo.",
      SETTINGS_UPDATE_FAILED: "No pudimos guardar tu configuración. Inténtalo de nuevo.",
      STATS_FETCH_FAILED: "No pudimos cargar tus estadísticas. Inténtalo de nuevo.",
      PDS_INFO_FETCH_FAILED: "No pudimos cargar la información de tu PDS. Inténtalo de nuevo.",
      PUSH_NOT_CONFIGURED: "Las notificaciones push no están disponibles en este servidor.",
      PUSH_SUBSCRIBE_FAILED: "No pudimos activar las notificaciones push. Inténtalo de nuevo.",
      PUSH_UNSUBSCRIBE_FAILED: "No pudimos desactivar las notificaciones push. Inténtalo de nuevo.",
      INBOX_CLOSED:
        "Esta bandeja de entrada está cerrada y no acepta mensajes nuevos en este momento.",
      MESSAGE_SEND_FAILED: "No pudimos enviar tu mensaje. Inténtalo de nuevo.",
      MESSAGE_NOT_FOUND: "No pudimos encontrar ese mensaje.",
      MESSAGE_DELETE_NOT_AUTHORIZED: "Ese mensaje no es tuyo, no puedes eliminarlo.",
      MESSAGE_DELETE_FAILED: "No pudimos eliminar ese mensaje. Inténtalo de nuevo.",
      BLUESKY_POST_FAILED: "No pudimos publicar tu respuesta en Bluesky. Inténtalo de nuevo.",
      ACCOUNT_DELETE_FAILED: "No pudimos eliminar los datos de tu cuenta. Inténtalo de nuevo.",
      RENDER_QUESTION_NOT_IN_INBOX: "Esa pregunta ya no está en tu bandeja de entrada.",
      RENDER_START_FAILED: "No pudimos generar la imagen. Inténtalo de nuevo.",
      LOGIN_INIT_FAILED: "No pudimos iniciar la sesión. Inténtalo de nuevo.",
      E2E_LOGIN_UNAVAILABLE: "El inicio de sesión de prueba no está disponible aquí.",
      E2E_LOGIN_NO_DID: "Error al iniciar sesión. Inténtalo de nuevo.",
    },
    generic: "Algo salió mal. Inténtalo de nuevo.",
  },
  notFoundPage: {
    title: "404 - No encontrado",
    message: "No se encontró el recurso solicitado.",
  },
} satisfies Messages;
