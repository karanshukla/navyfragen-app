import React, { createContext, useContext, useState, useEffect } from "react";

interface InstallPromptContextType {
  installPrompt: any | null;
  setInstallPrompt: React.Dispatch<React.SetStateAction<any | null>>;
}

const InstallPromptContext = createContext<
  InstallPromptContextType | undefined
>(undefined);

export const InstallPromptProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [installPrompt, setInstallPrompt] = useState<any | null>(null);

  useEffect(() => {
    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event);
    };
    const handleAppInstalled = () => {
      setInstallPrompt(null);
    };
    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);
    return () => {
      window.removeEventListener(
        "beforeinstallprompt",
        handleBeforeInstallPrompt
      );
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  return (
    <InstallPromptContext.Provider value={{ installPrompt, setInstallPrompt }}>
      {children}
    </InstallPromptContext.Provider>
  );
};

export function useInstallPrompt() {
  const context = useContext(InstallPromptContext);
  if (!context) {
    throw new Error(
      "useInstallPrompt must be used within an InstallPromptProvider"
    );
  }
  return context;
}
