import { useEffect, type RefObject } from "react";

const TEXT_ENTRY_TAGS = ["INPUT", "TEXTAREA", "SELECT"];

interface CardKeyboardNav {
  /**
   * How many cards are on screen; navigation wraps at both ends. The grid only
   * mounts with at least one card, so this is never zero.
   */
  count: number;
  focusedIndex: number;
  setFocusedIndex: (index: number) => void;
  /** Index of the card whose composer is open, or -1 when none is. */
  expandedIndex: number;
  onCollapse: () => void;
  cardRefs: RefObject<(HTMLDivElement | null)[]>;
}

/**
 * Alt/⌘+R to enter and cycle the question grid, arrows to walk it, Escape to
 * close an open composer and land focus back on its card.
 *
 * Escape is handled ahead of the text-entry guard on purpose: it is the only
 * shortcut that has to work while the composer's textarea has focus.
 *
 * @see [Messages.test.tsx](../tests/pages/Messages.test.tsx): pins the wrap in
 * both directions and that typing in the composer does not trigger navigation.
 */
export function useCardKeyboardNav({
  count,
  focusedIndex,
  setFocusedIndex,
  expandedIndex,
  onCollapse,
  cardRefs,
}: CardKeyboardNav) {
  useEffect(() => {
    const moveTo = (index: number) => {
      setFocusedIndex(index);
      cardRefs.current[index]?.focus();
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && expandedIndex !== -1) {
        event.preventDefault();
        onCollapse();
        cardRefs.current[expandedIndex]?.focus();
        return;
      }

      if (TEXT_ENTRY_TAGS.includes((event.target as HTMLElement)?.nodeName)) return;

      if ((event.altKey || event.metaKey) && event.key.toUpperCase() === "R") {
        event.preventDefault();
        moveTo(focusedIndex === -1 ? 0 : (focusedIndex + 1) % count);
        return;
      }

      if (focusedIndex === -1) return;

      if (event.key === "ArrowDown") {
        event.preventDefault();
        moveTo((focusedIndex + 1) % count);
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        moveTo((focusedIndex - 1 + count) % count);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [count, focusedIndex, setFocusedIndex, expandedIndex, onCollapse, cardRefs]);
}
