import { useLocalStorage } from "@mantine/hooks";

/**
 * The device-local posting preferences shown on the Messages page.
 *
 * Each one is its own localStorage entry (unchanged from when they were five
 * separate `useLocalStorage` calls in the page), but callers see one record and
 * one setter, so adding a preference no longer means threading another
 * value/setter pair through the component tree.
 */

export const PREFERENCE_KEYS = [
  "appendProfileLink",
  "useGradients",
  "includeQuestionAsImage",
  "confirmBeforeDelete",
  "autoScrollToMessages",
] as const;

export type PreferenceKey = (typeof PREFERENCE_KEYS)[number];
export type MessagePreferences = Record<PreferenceKey, boolean>;

const DEFAULTS: MessagePreferences = {
  appendProfileLink: false,
  useGradients: true,
  includeQuestionAsImage: true,
  confirmBeforeDelete: false,
  autoScrollToMessages: true,
};

function usePreference(key: PreferenceKey) {
  return useLocalStorage({
    key,
    defaultValue: DEFAULTS[key],
    getInitialValueInEffect: true,
  });
}

export interface MessagePreferencesState {
  preferences: MessagePreferences;
  setPreference: (key: PreferenceKey, value: boolean) => void;
  enabledCount: number;
}

export function useMessagePreferences(): MessagePreferencesState {
  const [appendProfileLink, setAppendProfileLink] = usePreference("appendProfileLink");
  const [useGradients, setUseGradients] = usePreference("useGradients");
  const [includeQuestionAsImage, setIncludeQuestionAsImage] =
    usePreference("includeQuestionAsImage");
  const [confirmBeforeDelete, setConfirmBeforeDelete] = usePreference("confirmBeforeDelete");
  const [autoScrollToMessages, setAutoScrollToMessages] = usePreference("autoScrollToMessages");

  const preferences: MessagePreferences = {
    appendProfileLink,
    useGradients,
    includeQuestionAsImage,
    confirmBeforeDelete,
    autoScrollToMessages,
  };

  const setters: Record<PreferenceKey, (value: boolean) => void> = {
    appendProfileLink: setAppendProfileLink,
    useGradients: setUseGradients,
    includeQuestionAsImage: setIncludeQuestionAsImage,
    confirmBeforeDelete: setConfirmBeforeDelete,
    autoScrollToMessages: setAutoScrollToMessages,
  };

  return {
    preferences,
    setPreference: (key, value) => setters[key](value),
    enabledCount: PREFERENCE_KEYS.filter((key) => preferences[key]).length,
  };
}
