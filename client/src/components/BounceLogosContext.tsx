import React, { createContext, useContext, useState } from "react";

const STORAGE_KEY = "nf-bounce-logos-enabled";

interface BounceLogosContextType {
  enabled: boolean;
  setEnabled: (enabled: boolean) => void;
}

const BounceLogosContext = createContext<BounceLogosContextType | undefined>(undefined);

function readStoredPreference(): boolean {
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return stored === null ? true : stored === "true";
}

export const BounceLogosProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [enabled, setEnabledState] = useState(readStoredPreference);

  const setEnabled = (value: boolean) => {
    setEnabledState(value);
    window.localStorage.setItem(STORAGE_KEY, String(value));
  };

  return (
    <BounceLogosContext.Provider value={{ enabled, setEnabled }}>
      {children}
    </BounceLogosContext.Provider>
  );
};

export function useBounceLogos() {
  const context = useContext(BounceLogosContext);
  if (!context) {
    throw new Error("useBounceLogos must be used within a BounceLogosProvider");
  }
  return context;
}
