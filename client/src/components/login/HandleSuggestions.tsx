import { Avatar, Box, Center, Group, Paper, Skeleton, Text, UnstyledButton } from "@mantine/core";
import { useState, type RefObject } from "react";

import { useTranslations } from "../../lib/i18n";
import type { BlueskyActor, HandleSearch } from "../../lib/useHandleSearch";

import * as styles from "./HandleSuggestions.styles";

function ActorIdentity({ actor, bold }: { actor: BlueskyActor; bold: boolean }) {
  return (
    <Group gap="sm" wrap="nowrap" px="sm" w="100%">
      <Avatar src={actor.avatar ?? null} size={40} radius="xl" />
      <Box style={{ minWidth: 0 }}>
        <Text size="sm" fw={bold ? 600 : 500} truncate>
          {actor.displayName || actor.handle}
        </Text>
        <Text size="xs" c="dimmed" truncate>
          @{actor.handle}
        </Text>
      </Box>
    </Group>
  );
}

function SuggestionRow({
  actor,
  onClick,
  buttonRef,
  onEscape,
}: {
  actor: BlueskyActor;
  onClick: () => void;
  buttonRef: RefObject<HTMLButtonElement | null>;
  onEscape: () => void;
}) {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <UnstyledButton
      ref={buttonRef}
      onClick={onClick}
      onFocus={(e) => setIsFocused(e.currentTarget.matches(":focus-visible"))}
      onBlur={() => setIsFocused(false)}
      onKeyDown={(e: React.KeyboardEvent) => {
        if (e.key === "Escape" || e.key === "ArrowUp") {
          e.preventDefault();
          onEscape();
        }
      }}
      w="100%"
      role="option"
      aria-selected={false}
      style={styles.row(isFocused)}
    >
      <ActorIdentity actor={actor} bold={false} />
    </UnstyledButton>
  );
}

function SkeletonRow() {
  return (
    <Box style={styles.staticRow} px="sm">
      <Group gap="sm" wrap="nowrap" w="100%">
        <Skeleton circle height={40} width={40} />
        <Box style={{ flex: 1 }}>
          <Skeleton height={12} width="55%" mb={6} />
          <Skeleton height={10} width="38%" />
        </Box>
      </Group>
    </Box>
  );
}

function Hint({ children }: { children: React.ReactNode }) {
  return (
    <Center style={styles.staticRow} aria-live="polite">
      <Text size="xs" c="dimmed">
        {children}
      </Text>
    </Center>
  );
}

interface HandleSuggestionsProps {
  search: HandleSearch;
  suggestionRef: RefObject<HTMLButtonElement | null>;
  onEscape: () => void;
}

/**
 * The single-row typeahead under the handle input. It always occupies one row's
 * worth of space — suggestion, skeleton or hint — so the Continue button never
 * jumps while the user types.
 */
export function HandleSuggestions({ search, suggestionRef, onEscape }: HandleSuggestionsProps) {
  const messages = useTranslations();
  const { selectedActor, isSearching, suggestions, noResults, isHandleReady, cleanHandle } = search;
  const isListbox = !selectedActor && (suggestions.length > 0 || (noResults && isHandleReady));

  return (
    <Paper
      radius="md"
      withBorder
      mt="xs"
      role={isListbox ? "listbox" : undefined}
      aria-label={isListbox ? messages.handleSuggestions.ariaLabel : undefined}
      style={styles.box}
    >
      {selectedActor ? (
        <Box style={styles.staticRow} px="sm">
          <ActorIdentity actor={selectedActor} bold />
        </Box>
      ) : isSearching ? (
        <SkeletonRow />
      ) : suggestions.length > 0 ? (
        <SuggestionRow
          actor={suggestions[0]}
          onClick={() => search.select(suggestions[0])}
          buttonRef={suggestionRef}
          onEscape={onEscape}
        />
      ) : noResults && isHandleReady ? (
        // Nothing in the Bluesky index, but the handle looks complete — offer it
        // directly so users on unindexed third-party PDSes can still proceed.
        <SuggestionRow
          actor={{ did: "", handle: cleanHandle }}
          onClick={() => search.select({ did: "", handle: cleanHandle })}
          buttonRef={suggestionRef}
          onEscape={onEscape}
        />
      ) : noResults ? (
        <Hint>{messages.handleSuggestions.noHandlesFound}</Hint>
      ) : (
        <Hint>{messages.handleSuggestions.startTyping}</Hint>
      )}
    </Paper>
  );
}
