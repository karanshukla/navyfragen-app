import { useEffect } from "react";
import { useNavigate } from "react-router";

const TEXT_ENTRY_TAGS = ["INPUT", "TEXTAREA", "SELECT"];

/** Alt+letter → route. Entries marked `private` need a session to be reachable. */
const ROUTES: { key: string; path: string; private: boolean }[] = [
  { key: "H", path: "/", private: false },
  { key: "M", path: "/messages", private: true },
  { key: "C", path: "/customise", private: true },
  { key: "S", path: "/settings", private: true },
];

/**
 * Global Alt+key navigation.
 *
 * @see [Navigation.test.tsx](../tests/Navigation.test.tsx): pins that the
 * logged-out shortcuts are inert and that typing in a field never navigates.
 */
export function useNavShortcuts({
  isLoggedIn,
  isSessionLoading,
  onNavigate,
}: {
  isLoggedIn: boolean;
  isSessionLoading: boolean;
  onNavigate?: () => void;
}) {
  const navigate = useNavigate();

  useEffect(() => {
    const targetFor = (key: string): string | null => {
      if (key === "L") return !isLoggedIn && !isSessionLoading ? "/login" : null;
      const route = ROUTES.find((r) => r.key === key);
      if (!route) return null;
      return route.private && !isLoggedIn ? null : route.path;
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (!event.altKey) return;
      if (TEXT_ENTRY_TAGS.includes((event.target as HTMLElement)?.nodeName)) return;

      const path = targetFor(event.key.toUpperCase());
      if (!path) return;

      event.preventDefault();
      navigate(path);
      onNavigate?.();
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isLoggedIn, isSessionLoading, navigate, onNavigate]);
}
