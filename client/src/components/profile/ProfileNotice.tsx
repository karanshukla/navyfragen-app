import { Alert, Container } from "@mantine/core";

interface ProfileNoticeProps {
  tone: "yellow" | "red";
  title: string;
  children: React.ReactNode;
}

/**
 * Terminal state for a profile that cannot be shown — bad handle, no Bluesky
 * account, no Navyfragen inbox, load failure. One shape for all four, and an
 * `Alert` rather than a bare `Paper` so the title picks up the tone colours the
 * theme already tunes for contrast.
 */
export function ProfileNotice({ tone, title, children }: ProfileNoticeProps) {
  return (
    <Container>
      <Alert color={tone} title={title} withCloseButton={false}>
        {children}
      </Alert>
    </Container>
  );
}
