import type { Messages } from "./types";

const numberFormat = new Intl.NumberFormat("pt");

/**
 * Portuguese adjectives agree in number with the noun they modify, like
 * Spanish — but unlike Spanish, `pluralRules.select(count)` returns "one" for
 * both 0 and 1 in Portuguese (CLDR classifies 0 with the singular form here),
 * so only counts of 2 or more take the plural form.
 */
const pluralRules = new Intl.PluralRules("pt");

function pluralize(count: number, singular: string, plural: string): string {
  return pluralRules.select(count) === "one" ? singular : plural;
}

export const pt = {
  common: {
    cancel: "Cancelar",
    confirm: "Confirmar",
    delete: "Excluir",
    retry: "Tentar novamente",
    copy: "Copiar",
    copied: "Copiado!",
    copyLink: "Copiar link",
    share: "Compartilhar",
    userAltFallback: "Usuário",
    respondToThreadRootFirst: "Responda primeiro à raiz do tópico",
    errorTitle: "Erro",
    accessDeniedMessage: "Você não pode acessar esta página sem fazer login.",
    settingsLoadErrorTitle: "Não foi possível carregar as configurações",
    switchedToAccount: (handle: string) => `Você mudou para @${handle}`,
    shortcuts: {
      title: "Atalhos de teclado",
      home: "Início",
      login: "Entrar",
      messages: "Mensagens",
      settings: "Configurações",
      customise: "Personalizar",
      focusCycleCards: "Focar / percorrer cartões",
      navigateCards: "Navegar entre cartões",
      closeExpandedCard: "Fechar cartão expandido",
    },
  },
  messagesPage: {
    themeUpdateErrorTitle: "Erro ao atualizar o tema",
    addExamplesErrorTitle: "Erro ao adicionar exemplos",
    deleteErrorTitle: "Erro ao excluir mensagem",
    threadReplyTitle: "Adicionado ao tópico!",
    responseSentTitle: "Resposta enviada!",
    responseErrorTitle: "Erro ao responder",
    emptyResponseTitle: "Resposta vazia",
    emptyResponseMessage: "A resposta não pode estar vazia.",
    imageRenderFailedTitle: "Erro ao gerar a imagem",
    imageRenderFailedMessage: "Não foi possível gerar a imagem da pergunta.",
    notLoggedInTitle: "Você não está logado",
    notLoggedInMessage: "Faça login para ver suas mensagens.",
    heading: "Mensagens",
    noMessagesCount: "sem mensagens",
    newMessagesCount: (count: number) =>
      `${numberFormat.format(count)} ${pluralize(count, "nova", "novas")}`,
    noMessagesTitle: "Sem mensagens",
    noMessagesBody:
      "Você ainda não tem mensagens. Compartilhe o link da sua caixa de entrada para receber perguntas anônimas.",
    addExampleMessages: "Adicionar mensagens de exemplo",
    deleteConfirmTitle: "Confirmar exclusão",
    deleteConfirmMessage:
      "Tem certeza de que deseja excluir esta mensagem? Esta ação não pode ser desfeita.",
    threadReplyPosted: "Adicionado ao tópico.",
    responsePosted: "Sua resposta foi publicada.",
    welcomeBackTitle: "Bem-vindo de volta!",
    welcomeBackMessage: "Você fez login com sucesso.",
  },
  inboxLinkCard: {
    eyebrow: "Link da sua caixa de entrada · acesso público",
  },
  postingPreferences: {
    title: "Preferências de publicação",
    appendProfileLink: {
      label: "Anexar link da caixa de entrada automaticamente",
      description: "Adiciona seu link a cada publicação. Reduz o limite de caracteres.",
    },
    useGradients: {
      label: "Fundos em gradiente",
      description: "Bonito para capturas de tela. Desative para mais contraste.",
    },
    includeQuestionAsImage: {
      label: "Pergunta como imagem",
      description: "Gera uma imagem compartilhável com texto alternativo automático.",
    },
    confirmBeforeDelete: {
      label: "Confirmar antes de excluir",
      description: "Desative se quiser excluir mensagens em massa.",
    },
    autoScrollToMessages: {
      label: "Rolagem automática até as mensagens",
      description: "Rola as mensagens novas para a tela quando são carregadas.",
    },
    summary: (enabled: number, total: number) =>
      `${numberFormat.format(enabled)} de ${numberFormat.format(total)} ativas`,
  },
  questionCard: {
    cannotDeleteThreadRootTooltip: "Desafixe o tópico primeiro",
    cannotDeleteThreadRootLabel: "Não é possível excluir a raiz do tópico",
    cannotDeleteWhilePostingTooltip: "Termine de publicar primeiro",
    cannotDeleteWhilePostingLabel: "Não é possível excluir durante a publicação",
    unpinThreadTooltip: "Desafixar tópico",
    pinAsThreadRootTooltip: "Fixar como raiz do tópico",
    unpinThreadRootLabel: "Desafixar raiz do tópico",
    setAsThreadRootLabel: "Definir como raiz do tópico",
    deleteMessageTooltip: "Excluir mensagem",
    deleteMessageLabel: "Excluir mensagem",
    replyToThread: "↩ Responder ao tópico",
    reply: "↩ Responder",
  },
  replyComposer: {
    stillRenderingImage: "Ainda gerando a imagem da sua pergunta…",
    renderingImage: "Gerando a imagem da sua pergunta…",
    posting: "Publicando…",
    stillGoingWakingRenderer: "Ainda em andamento, ativando o gerador de imagens…",
    stillGoing: "Ainda em andamento…",
    responseAriaLabel: "Sua resposta",
    placeholder: "escreva sua resposta…",
    replyToThread: "Responder ao tópico",
    reply: "Responder",
  },
  imageThemePicker: {
    title: "Tema da imagem",
  },
  themes: {
    image: {
      default: "Padrão",
      compressed: "Compactado",
      twitter: "Estilo Twitter",
    },
    profileCard: {
      royal: "Real",
      aurora: "Aurora",
      ember: "Brasa",
      verdant: "Verdejante",
    },
  },
  nav: {
    friendGroups: {
      moots: {
        label: "Amigos mútuos",
        emptyText: (appName: string) => `Você ainda não tem amigos mútuos no ${appName}.`,
      },
      following: {
        label: "Seguindo",
        emptyText: (appName: string) => `Você ainda não tem seguidos unilaterais no ${appName}.`,
      },
      oomfs: {
        label: "Oomfs",
        emptyText: (appName: string) => `Nenhum dos seus seguidores está no ${appName} ainda.`,
      },
    },
    viewingProfile: "Vendo perfil",
    unreadCount: (count: number) =>
      `${numberFormat.format(count)} ${pluralize(count, "não lida", "não lidas")}`,
  },
  appHeader: {
    disableAnimations: "Desativar animações",
    enableAnimations: "Ativar animações",
    toggleColorScheme: "Alternar esquema de cores",
  },
  customisePage: {
    heading: "Personalizar",
    beta: "Beta",
    yourPublicProfile: "Seu perfil público",
    yourPublicProfileHelp:
      "O que os visitantes veem antes de enviar uma mensagem anônima para você.",
    profilePrompt: "Frase do perfil",
    profilePromptDescription:
      "O título mostrado acima da sua caixa de mensagem. Deixe em branco para usar «Envie uma mensagem anônima para [você]».",
    profilePromptPlaceholder: "Pergunte-me qualquer coisa…",
    profileCardColour: "Cor do cartão de perfil",
    profileCardColourDescription:
      "O esquema de cores do seu cartão de perguntas. As predefinições selecionadas mantêm o texto e o botão legíveis em todas as opções.",
    languages: "Idiomas",
    languagesHelp:
      "Dois públicos, dois idiomas: aquele em que você lê o app e aquele que seus visitantes leem.",
    appLanguage: "Idioma do app",
    appLanguageDescription:
      "O idioma em que você lê o app: navegação, botões e notificações. Só você vê isso.",
    messageLanguage: "Idioma das mensagens",
    messageLanguageDescription:
      "Idioma da frase, do texto de compartilhamento e do aviso de anonimato mostrado aos visitantes e ao seu público. Sua frase de perfil personalizada tem prioridade sobre esta configuração.",
    messageIntake: "Recebimento de mensagens",
    messageIntakeHelp: "Quem pode alcançar sua caixa de entrada e o que passa.",
    inbox: "Caixa de entrada",
    inboxDescription:
      "Desative para parar de receber novas mensagens mantendo sua conta, histórico e configurações intactos. Os visitantes verão um estado de «não aceita mensagens».",
    profanityFilter: "Filtro de palavrões",
    profanityFilterDescription:
      "Quando ativado, as mensagens recebidas são filtradas com listas de palavras em inglês, espanhol, português, alemão e francês - cada mensagem é verificada nos cinco idiomas, qualquer que seja o idioma configurado no app. Mensagens sinalizadas são descartadas silenciosamente - quem envia vê uma resposta de sucesso, mas a mensagem nunca chega à sua caixa de entrada.",
  },
  publicProfilePage: {
    messageEmptyError: "A mensagem não pode estar vazia.",
    recipientNotFoundTitle: "Erro",
    recipientNotFoundMessage: "Não é possível enviar a mensagem: DID do usuário não encontrado.",
    messageSentTitle: "Mensagem enviada!",
    messageSentBody: "Sua mensagem anônima está a caminho.",
    sendFailedTitle: "Falha ao enviar",
    noBlueskyAccountTitle: "Nenhuma conta do Bluesky encontrada",
    noBlueskyAccountBody: "não existe no Bluesky. Verifique o usuário e tente novamente.",
    notOnAppTitle: (appName: string) => `Não está no ${appName}`,
    notOnAppBodyPrefix:
      "tem uma conta do Bluesky, mas ainda não configurou sua caixa de entrada no ",
    notOnAppBodySuffix: ".",
    profileLoadFailed: "Não foi possível carregar as informações do perfil.",
    confirmSendTitle: "Confirmar mensagem anônima",
    confirmSendMessage:
      "Tem certeza de que deseja enviar esta mensagem anônima? Esta ação não pode ser desfeita.",
    sendMessage: "Enviar mensagem",
    handleResolveFailed: "Não foi possível resolver o usuário. Ele pode não existir.",
    sendMessageFailed: "Não foi possível enviar a mensagem. Tente novamente.",
  },
  askCard: {
    clearMessage: "Limpar mensagem",
  },
  profileCard: {
    viewOnBluesky: "Ver no Bluesky",
  },
  profileUrlBar: {
    shareFailedTitle: "Falha ao compartilhar",
    shareFailedMessage: "Não foi possível compartilhar o link.",
    copyProfileLinkAriaLabel: "Copiar link do perfil",
    shareProfileLinkAriaLabel: "Compartilhar link do perfil",
  },
  loginPage: {
    handleRequired: "O usuário é obrigatório",
    handleTooLong: "Usuário muito longo",
    oauthFailedMessage: "Falha ao fazer login. Tente novamente.",
    logInToPrefix: "Fazer login em ",
    subtitle: "Digite seu usuário do AT Protocol para continuar",
    atmosphereHandle: "Usuário do Atmosphere",
    handlePlaceholder: "ex. seunome.bsky.social",
    continueButton: "Continuar",
    disclaimerPrefix: "Você será direcionado ao Bluesky para se autenticar. ",
    disclaimerMiddle: " não tem acesso à sua senha. Verifique se você vê ",
    disclaimerSuffix: " na página de login.",
  },
  handleSuggestions: {
    ariaLabel: "Sugestões de usuário",
    noHandlesFound: "Nenhum usuário encontrado",
    startTyping: "Comece a digitar para ver sugestões de usuário",
  },
  e2eLoginPanel: {
    modeNotice: "Modo de teste E2E - não usar em produção",
    identifier: "Identificador",
    identifierPlaceholder: "usuario.pds.example",
    appPassword: "Senha de aplicativo",
    appPasswordPlaceholder: "xxxx-xxxx-xxxx-xxxx",
    signIn: "Entrar (E2E)",
  },
  oauthCallback: {
    missingToken: "Token de OAuth ausente na URL de retorno.",
    loggingIn: "Fazendo login…",
    completingAuth: "Concluindo sua autenticação do Bluesky",
    loginFailed: "Falha ao fazer login",
    tryAgain: "Tentar novamente",
    redirectNotice: "Você será redirecionado automaticamente quando o login for concluído.",
  },
  pushNotificationsCard: {
    description:
      "Receba uma notificação push quando uma mensagem chegar. Aceite o aviso do navegador para ativá-la; limpar os dados do site a desativa. Cobre todas as contas conectadas neste dispositivo.",
    serverUnavailable: "As notificações push não estão configuradas neste servidor.",
    browserUnsupported: "Este navegador não pode receber notificações push.",
    browserBlocked:
      "Bloqueadas nas configurações do seu navegador. Permita novamente as notificações para este site para ativá-las.",
    toastTitle: "Notificações push",
    title: "Notificações push",
  },
  shareButton: {
    linkCopiedTitle: "Copiado!",
    linkCopiedMessage: "Link copiado para a área de transferência.",
    copyFailedTitle: "Falha ao copiar",
    copyFailedMessage: "Falha ao copiar o link para a área de transferência.",
    sharingUnavailableTitle: "Compartilhamento indisponível",
    sharingUnavailableMessage: "O compartilhamento não é compatível com este navegador.",
    button: "Compartilhar",
  },
  questionRender: {
    renderLost: "Não foi possível gerar a imagem da pergunta. Tente enviar novamente.",
    renderUnreachable: "Não foi possível verificar a imagem da pergunta. Tente enviar novamente.",
  },
  notificationService: {
    serverUnavailable: "As notificações push não estão disponíveis neste servidor",
    browserUnsupported: "As notificações push não são compatíveis com este navegador",
    permissionDenied: "A permissão de notificação não foi concedida",
    subscriptionMissingEndpoint: "A assinatura push não retornou nenhum endpoint",
  },
  updateAvailableButton: {
    ariaLabel: "Atualização disponível — recarregue para aplicar",
    buttonLabel: "Atualizar",
    applyingAriaLabel: "Aplicando a atualização — a página será recarregada",
    applyingLabel: "Atualizando…",
  },
  userMenu: {
    switchAccountErrorTitle: "Não foi possível trocar de conta",
    userAvatarAltFallback: "Avatar do usuário",
    accountsLabel: "Contas",
    addAccount: "Adicionar conta",
    viewProfile: "Ver perfil",
    logOut: (handle: string | undefined) => `Sair @${handle}`,
  },
  home: {
    titleSuffix: " - Perguntas e respostas anônimas no Bluesky",
    subtitle: "Receba perguntas da web e publique as respostas diretamente no Bluesky.",
    sellingPoints: {
      fastAndFree: {
        title: "Rápido e gratuito",
        body: "Nenhum download necessário, basta fazer login com suas credenciais do Bluesky e compartilhar o link da sua caixa de entrada",
      },
      spamProtection: {
        title: "Proteção contra spam, sem captchas",
        body: "Protegido pelo Anubis, um poderoso serviço de detecção de bots",
      },
      openSource: {
        title: "Código aberto",
        body: "Contribua diretamente para o projeto, ou hospede sua própria versão se quiser!",
      },
    },
    questionsFeedback: "Perguntas? Comentários?",
    reachOutOnBluesky: "Entre em contato no Bluesky",
    submitAnIssueOnGitHub: "Envie um issue no GitHub",
    githubContactLabel: "GitHub - ",
    disclaimer:
      "Aviso: siga os termos de serviço do Bluesky. Cookies são usados para manter você conectado. Este app não inclui nenhuma moderação.",
    welcomeBackGreetingPrefix: "Que bom te ver de novo,",
    viewYourMessages: "Ver suas mensagens",
    copyProfileLink: "Copiar link do perfil",
    copyLinkButton: "Copiar link",
    getStarted: "Começar",
    shareTitle: (appName: string) => `Envie mensagens anônimas para mim no ${appName}!`,
  },
  settingsPage: {
    heading: "Configurações",
    accountOverview: "Visão geral da conta",
    updateFailedTitle: "Falha na atualização",
    pdsSync: "Sincronização com o PDS",
    messagesInInbox: "Mensagens na caixa de entrada",
    answersOnPds: "Respostas no PDS",
    activeSince: "Ativo desde",
    pdsLabel: "PDS",
    installApplication: "Instalar aplicativo",
    installApplicationDescription:
      "Instale o app para acesso mais rápido em qualquer dispositivo: celular, tablet ou laptop. Ele roda no mesmo navegador, e você pode desinstalá-lo quando quiser.",
    install: "Instalar ",
    openFeedOnBluesky: "Abrir feed no Bluesky",
    dailyNotifications: "Notificações diárias",
    viewBotOnBluesky: "Ver bot no Bluesky",
    followTheBotOnBluesky: "Seguir o bot no Bluesky",
    deleteMyData: "Excluir meus dados",
    deleteAccountTitle: "Excluir conta",
    deleteAccountMessage:
      "Tem certeza de que deseja excluir sua conta e todos os dados? Isso não pode ser desfeito.",
    pdsSyncDescription: (appName: string) =>
      `${appName} sincroniza suas mensagens anônimas com seu PDS do Bluesky (servidor de dados pessoais). Desative isso para mantê-las apenas nos servidores do ${appName}. A publicação no Bluesky não é afetada.`,
    feedTitle: (appName: string) => `Feed do ${appName}`,
    feedDescription: (appName: string) =>
      `Explore perguntas e respostas anônimas publicadas por todos no ${appName} ao redor do mundo. Este feed pode conter conteúdo destinado a adultos. Veja por sua conta e risco.`,
    dailyNotificationsDescription: (appName: string) =>
      `Siga o bot de notificações do ${appName} no Bluesky para receber um alerta diário quando você tiver novas mensagens na sua caixa de entrada.`,
    deleteMyDataDescription: (appName: string) =>
      `Remova permanentemente todos os seus dados dos servidores do ${appName} e do PDS do Bluesky. Isso também desativa sua caixa de entrada, então você deixará de receber mensagens. Você sempre pode fazer login novamente para se registrar automaticamente.`,
  },
  errors: {
    codes: {
      NOT_AUTHENTICATED: "Você não está conectado. Faça login e tente novamente.",
      SESSION_EXPIRED: "Sua sessão expirou. Faça login novamente.",
      ACCOUNT_SESSION_EXPIRED: "A sessão dessa conta expirou. Faça login novamente.",
      AGENT_INIT_FAILED: "Não conseguimos verificar sua sessão. Faça login novamente.",
      INVALID_HANDLE: "Isso não parece ser um usuário válido do Bluesky.",
      INVALID_DID: "Esse identificador de conta não é válido.",
      DID_REQUIRED: "Um identificador de conta é obrigatório.",
      RECIPIENT_DID_REQUIRED: "Um destinatário é obrigatório.",
      MESSAGE_TID_REQUIRED: "Um identificador de mensagem é obrigatório.",
      HANDLE_NOT_FOUND: "Não conseguimos encontrar esse usuário.",
      USER_NOT_FOUND: "Não conseguimos encontrar esse usuário.",
      PROFILE_NOT_FOUND: "Não conseguimos encontrar esse perfil.",
      MISSING_OAUTH_TOKEN: "Seu link de login está sem um token obrigatório.",
      INVALID_OAUTH_TOKEN: "Seu link de login expirou ou é inválido.",
      SERVER_MISCONFIGURED: "O servidor está mal configurado. Tente novamente mais tarde.",
      LOGOUT_FAILED: "Não conseguimos desconectar você. Tente novamente.",
      ACCOUNT_SWITCH_FAILED: "Não conseguimos trocar de conta. Tente novamente.",
      EXAMPLE_MESSAGES_FAILED: "Não conseguimos adicionar mensagens de exemplo. Tente novamente.",
      MESSAGES_FETCH_FAILED: "Não conseguimos carregar suas mensagens. Tente novamente.",
      PDS_SYNC_FAILED: "Não conseguimos sincronizar suas mensagens. Tente novamente.",
      PROFILE_FETCH_FAILED: "Não conseguimos carregar esse perfil. Tente novamente.",
      USER_EXISTENCE_CHECK_FAILED: "Não conseguimos verificar esse usuário agora.",
      FRIENDS_FETCH_FAILED: "Não conseguimos carregar seus amigos. Tente novamente.",
      BOT_FOLLOW_CHECK_FAILED: "Não conseguimos verificar se você segue o bot.",
      PDS_RESOLVE_FAILED: "Não conseguimos resolver o servidor desse usuário.",
      HANDLE_SEARCH_FAILED: "Não conseguimos buscar usuários agora.",
      HANDLE_RESOLVE_FAILED: "Não conseguimos resolver esse usuário.",
      SETTINGS_FETCH_FAILED: "Não conseguimos carregar suas configurações. Tente novamente.",
      SETTINGS_UPDATE_FAILED: "Não conseguimos salvar suas configurações. Tente novamente.",
      STATS_FETCH_FAILED: "Não conseguimos carregar suas estatísticas. Tente novamente.",
      PDS_INFO_FETCH_FAILED: "Não conseguimos carregar as informações do seu PDS. Tente novamente.",
      PUSH_NOT_CONFIGURED: "As notificações push não estão disponíveis neste servidor.",
      PUSH_SUBSCRIBE_FAILED: "Não conseguimos ativar as notificações push. Tente novamente.",
      PUSH_UNSUBSCRIBE_FAILED: "Não conseguimos desativar as notificações push. Tente novamente.",
      INBOX_CLOSED:
        "Esta caixa de entrada está fechada e não está aceitando novas mensagens no momento.",
      MESSAGE_SEND_FAILED: "Não conseguimos enviar sua mensagem. Tente novamente.",
      MESSAGE_NOT_FOUND: "Não encontramos essa mensagem.",
      MESSAGE_DELETE_NOT_AUTHORIZED: "Você não tem permissão para excluir essa mensagem.",
      MESSAGE_DELETE_FAILED: "Não conseguimos excluir essa mensagem. Tente novamente.",
      BLUESKY_POST_FAILED: "Não conseguimos publicar sua resposta no Bluesky. Tente novamente.",
      ACCOUNT_DELETE_FAILED: "Não conseguimos excluir os dados da sua conta. Tente novamente.",
      RENDER_QUESTION_NOT_IN_INBOX: "Essa pergunta não está mais na sua caixa de entrada.",
      RENDER_START_FAILED: "Não conseguimos gerar a imagem. Tente novamente.",
      LOGIN_INIT_FAILED: "Não conseguimos iniciar o login. Tente novamente.",
      E2E_LOGIN_UNAVAILABLE: "O login de teste não está disponível aqui.",
      E2E_LOGIN_NO_DID: "Falha ao fazer login. Tente novamente.",
    },
    generic: "Algo deu errado. Tente novamente.",
  },
  notFoundPage: {
    title: "404 - Não encontrado",
    message: "O recurso solicitado não foi encontrado.",
  },
} satisfies Messages;
