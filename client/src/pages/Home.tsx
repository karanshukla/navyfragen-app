import {
  Avatar,
  Button,
  CopyButton,
  Divider,
  Group,
  List,
  Paper,
  SimpleGrid,
  Skeleton,
  Stack,
  Center,
  Text,
  Title,
  Tooltip,
} from "@mantine/core";
import { IconBrandGithub, IconButterfly, IconClipboard, IconShare } from "@tabler/icons-react";
import React from "react";
import { Link } from "react-router";

import { useSession } from "../api/authService";
import { useSyncMessages } from "../api/messageService";
import { ShortcutList, type Shortcut } from "../components/ShortcutList";
import { WinkMark } from "../components/WinkMark";
import { BRAND_GRADIENT } from "../styles/tokens";

import * as styles from "./Home.styles";

const shortlinkurl = import.meta.env.VITE_SHORTLINK_URL || "localhost:5173/profile";

const SIGNED_OUT_SHORTCUTS: Shortcut[] = [
  { label: "Home", hint: "Alt+H" },
  { label: "Login", hint: "Alt+L" },
];

const SIGNED_IN_SHORTCUTS: Shortcut[] = [
  { label: "Home", hint: "Alt+H" },
  { label: "Messages", hint: "Alt+M" },
  { label: "Settings", hint: "Alt+S" },
  { label: "Focus / cycle cards", hint: "Alt+R" },
  { label: "Navigate cards", hint: "↑ / ↓" },
];

const SELLING_POINTS = [
  {
    title: "Fast and free",
    body: "No downloads required, just log in with your Bluesky credentials and share your inbox link",
  },
  {
    title: "Spam protection, without captchas",
    body: "Protected by Anubis, a powerful bot detection service",
  },
  {
    title: "Open source",
    body: "Contribute directly to the project, or host your own version if you want!",
  },
];

export default function Home() {
  const { data: sessionData, isLoading } = useSession();
  const syncMessagesMutation = useSyncMessages();
  const isLoggedIn = !!sessionData?.isLoggedIn;

  React.useEffect(() => {
    if (sessionData?.did) {
      syncMessagesMutation.mutate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionData?.did]);

  return (
    <>
      <Title order={1} mb={6} style={{ letterSpacing: "-0.03em" }}>
        Navyfragen - Anonymous questions and answers on Bluesky
      </Title>
      <Text mb="xl" fz={15} c="dimmed">
        Receive questions from the web and post the answers directly on Bluesky.
      </Text>

      {isLoading ? (
        <HeroSkeleton />
      ) : sessionData?.profile ? (
        <WelcomeBack profile={sessionData.profile} />
      ) : (
        <SignedOutHero />
      )}

      <SimpleGrid cols={{ base: 1, sm: 2 }} mt="md">
        <Paper p="lg" radius="md" withBorder style={styles.infoCard}>
          <ShortcutList
            title="Keyboard Shortcuts"
            shortcuts={isLoggedIn ? SIGNED_IN_SHORTCUTS : SIGNED_OUT_SHORTCUTS}
          />
        </Paper>

        <Paper p="lg" radius="md" withBorder style={styles.infoCard}>
          <Title order={2} style={styles.infoHeading}>
            Questions? Feedback?
          </Title>
          <Stack gap="sm">
            <ContactLink
              caption="Reach out on Bluesky"
              href="https://bsky.app/profile/navyfragen.app"
              icon={<IconButterfly size={18} />}
            >
              @navyfragen.app
            </ContactLink>
            <ContactLink
              caption="Submit an issue on GitHub"
              href="https://github.com/karanshukla/navyfragen-app"
              icon={<IconBrandGithub size={18} />}
            >
              GitHub - Navyfragen
            </ContactLink>
            <Divider />
            <Text fz={13}>
              Disclaimer: Please follow Bluesky&apos;s ToS. Cookies are used to keep you logged in.
              This app does not include any moderation.
            </Text>
          </Stack>
        </Paper>
      </SimpleGrid>
    </>
  );
}

function HeroSkeleton() {
  return (
    <Paper p="xl" radius="lg" withBorder>
      <Stack gap="lg">
        <Skeleton height={30} width="60%" />
        <Skeleton height={20} />
        <Skeleton height={20} />
        <Center mt="md">
          <Skeleton height={42} width={180} radius="md" />
        </Center>
      </Stack>
    </Paper>
  );
}

interface SessionProfile {
  avatar?: string | null;
  displayName?: string | null;
  handle?: string;
}

function WelcomeBack({ profile }: { profile: SessionProfile }) {
  const name = profile.displayName || profile.handle;
  const url = `https://${shortlinkurl}/${profile.handle}`;

  const share = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: "Send me anonymous messages on Navyfragen!", url });
      } catch {
        // share sheet dismissed or unavailable
      }
    } else if (navigator.clipboard) {
      await navigator.clipboard.writeText(url);
    }
  };

  return (
    <Paper radius="lg" withBorder style={styles.hero}>
      <Stack gap="md">
        <Center>
          <Avatar
            src={profile.avatar ?? undefined}
            alt={name}
            size={84}
            radius="xl"
            style={styles.heroAvatar}
          >
            <WinkMark size={60} sparkle={false} aria-hidden />
          </Avatar>
        </Center>
        <Center>
          <Text fw={800} fz={26} style={styles.greeting}>
            Good to see you again,{" "}
            <Text component="span" fw={800} inherit style={styles.greetingName}>
              {name}
            </Text>
            !
          </Text>
        </Center>
      </Stack>
      <Center mt="xl">
        <Group gap="xs" align="center" wrap="wrap" justify="center">
          <Button
            component={Link}
            to="/messages"
            size="lg"
            radius="md"
            variant="gradient"
            gradient={BRAND_GRADIENT}
          >
            View Your Messages
          </Button>
          <CopyButton value={url}>
            {({ copied, copy }) => (
              <Tooltip label={copied ? "Copied!" : "Copy profile link"} withArrow>
                <Button
                  onClick={copy}
                  size="sm"
                  radius="xl"
                  variant="default"
                  leftSection={<IconClipboard size={14} />}
                >
                  {copied ? "Copied!" : "Copy Link"}
                </Button>
              </Tooltip>
            )}
          </CopyButton>
          <Button
            size="sm"
            radius="xl"
            variant="default"
            leftSection={<IconShare size={14} />}
            onClick={share}
          >
            Share
          </Button>
        </Group>
      </Center>
    </Paper>
  );
}

function SignedOutHero() {
  return (
    <Paper p="xl" radius="lg" withBorder style={styles.infoCard}>
      <List spacing="md" size="md">
        {SELLING_POINTS.map(({ title, body }) => (
          <List.Item key={title}>
            <Text fw={500}>{title}</Text>
            <Text c="dimmed">{body}</Text>
          </List.Item>
        ))}
      </List>
      <Center mt="xl">
        <Button
          component={Link}
          to="/login"
          size="lg"
          radius="md"
          variant="gradient"
          gradient={BRAND_GRADIENT}
        >
          Get Started
        </Button>
      </Center>
    </Paper>
  );
}

function ContactLink({
  caption,
  href,
  icon,
  children,
}: {
  caption: string;
  href: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div>
      <Text fz={15} mb={4}>
        {caption}
      </Text>
      <a href={href} target="_blank" rel="noopener noreferrer" style={styles.contactLink}>
        {icon} {children}
      </a>
    </div>
  );
}
