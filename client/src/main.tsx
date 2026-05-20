import {
  ActionIcon,
  AppShell,
  Avatar,
  Box,
  Burger,
  Button,
  Container,
  Flex,
  Group,
  Loader,
  MantineProvider,
  Menu,
  Paper,
  Text,
  Title,
  useComputedColorScheme,
  useMantineColorScheme,
} from "@mantine/core";
import { Notifications } from "@mantine/notifications";
import { IconLogout, IconMoon, IconSun, IconUser } from "@tabler/icons-react";
import { QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import React, { useEffect, useRef } from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Link, Route, Routes } from "react-router-dom";

import { useSession, useLogout } from "./api/authService";
import { queryClient } from "./api/queryClient";
import { InstallPromptProvider } from "./components/InstallPromptContext";
import { WinkMark } from "./components/WinkMark";
import { Wordmark } from "./components/Wordmark";
import { Navigation } from "./Navigation";
import Home from "./pages/Home";
import Login from "./pages/Login";
import Messages from "./pages/Messages";
import OAuthCallback from "./pages/OAuthCallback";
import PublicProfile from "./pages/PublicProfile";
import Settings from "./pages/Settings";
import navyfragenTheme from "./Theme";

import "@mantine/core/styles.css";
import "./index.css";

function AppLayout() {
  const [opened, setOpened] = React.useState(false);
  const { data: sessionData, isLoading } = useSession();
  const { mutate: logout } = useLogout();
  const { toggleColorScheme } = useMantineColorScheme();
  const computedColorScheme = useComputedColorScheme("light", { getInitialValueInEffect: true });

  const navbarRef = useRef<HTMLDivElement>(null);
  const burgerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        opened &&
        navbarRef.current &&
        !navbarRef.current.contains(event.target as Node) &&
        burgerRef.current &&
        !burgerRef.current.contains(event.target as Node)
      ) {
        setOpened(false);
      }
    };

    if (opened) {
      document.addEventListener("mousedown", handleClickOutside);
    } else {
      document.removeEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [opened]);

  const isLoggedIn = !!sessionData?.isLoggedIn;
  const userProfile = sessionData?.profile;

  return (
    <AppShell
      header={{ height: 60 }}
      navbar={{
        width: 250,
        breakpoint: "sm",
        collapsed: { mobile: !opened, desktop: false },
      }}
      padding="md"
    >
      <AppShell.Header>
        <Group h="100%" px="md">
          <Burger
            ref={burgerRef}
            opened={opened}
            onClick={() => setOpened((o) => !o)}
            hiddenFrom="sm"
            size="sm"
          />
          <Box component={Link} to="/" style={{ textDecoration: "none", display: "flex", alignItems: "center" }}>
            <Wordmark size={18} />
          </Box>
          <Flex
            gap="sm"
            justify="flex-end"
            align="center"
            style={{ flexGrow: 1 }}
          >
            <ActionIcon
              onClick={() => toggleColorScheme()}
              aria-label="Toggle color scheme"
              size={36}
              radius="xl"
              variant="transparent"
              style={{
                background: computedColorScheme === "dark" ? "rgba(255,255,255,0.06)" : "#F2EBFF",
                color: "var(--mantine-color-text)",
              }}
            >
              {computedColorScheme === "dark" ? <IconSun size={18} /> : <IconMoon size={18} />}
            </ActionIcon>
            {isLoading ? (
              <Loader size="sm" />
            ) : isLoggedIn && userProfile ? (
              <Menu
                shadow="md"
                width={240}
                position="bottom-end"
                middlewares={{ shift: true, flip: true }}
                styles={{ item: { padding: "12px 16px", fontSize: "var(--mantine-font-size-sm)" } }}
              >
                <Menu.Target>
                  <Button
                    variant="transparent"
                    px={8}
                    style={{
                      background: computedColorScheme === "dark" ? "rgba(255,255,255,0.06)" : "#F2EBFF",
                      borderRadius: 999,
                      height: 36,
                      color: "var(--mantine-color-text)",
                    }}
                  >
                    <Group gap="xs">
                      <Avatar
                        size={28}
                        src={userProfile.avatar || undefined}
                        alt={userProfile.displayName || "User Avatar"}
                        radius="xl"
                      >
                        <WinkMark size={22} sparkle={false} aria-hidden />
                      </Avatar>
                      <Box visibleFrom="sm">
                        <Text size="sm" truncate fw={600} style={{ fontFamily: "Inter" }}>
                          {userProfile.displayName}
                        </Text>
                      </Box>
                    </Group>
                  </Button>
                </Menu.Target>
                <Menu.Dropdown>
                  <Menu.Item
                    component={Link}
                    to={`/profile/${userProfile.handle}`}
                    onClick={() => setOpened(false)}
                    leftSection={<IconUser size="1.2rem" stroke={1.5} />}
                  >
                    View Profile
                  </Menu.Item>
                  <Menu.Item
                    onClick={() => {
                      try {
                        document.body.style.pointerEvents = "none";
                        document.body.style.opacity = "0.5";
                        logout();
                      } catch (e) {
                        console.error("Logout failed, please refresh", e);
                      }
                      setOpened(false);
                    }}
                    leftSection={<IconLogout size="1.2rem" stroke={1.5} />}
                  >
                    Logout
                  </Menu.Item>
                </Menu.Dropdown>
              </Menu>
            ) : (
              <Button
                component={Link}
                to="/login"
                variant="gradient"
                gradient={{ from: "royal", to: "purple", deg: 135 }}
                size="xs"
                onClick={() => setOpened(false)}
              >
                Login
              </Button>
            )}
          </Flex>
        </Group>
      </AppShell.Header>
      <AppShell.Navbar ref={navbarRef} p="md" style={{ overflow: "hidden" }}>
        <Navigation
          onLinkClick={() => setOpened(false)}
          isLoggedIn={isLoggedIn}
          handle={userProfile?.handle}
        />
      </AppShell.Navbar>
      <AppShell.Main pt={70}>
        <Container pt="md">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login />} />
            <Route path="/messages" element={<Messages />} />
            <Route path="/profile" element={<PublicProfile />} />
            <Route path="/profile/:handle" element={<PublicProfile />} />
            <Route path="/oauth_callback" element={<OAuthCallback />} />
            <Route path="/settings" element={<Settings />} />
            <Route
              path="*"
              element={
                <Container>
                  <Paper p="xl" radius="md" withBorder shadow="xs">
                    <Title order={2} c="red">
                      404 - Not Found
                    </Title>
                    <Text c="dimmed" mt="md">
                      The requested resource was not found.
                    </Text>
                  </Paper>
                </Container>
              }
            />
          </Routes>
        </Container>
      </AppShell.Main>
    </AppShell>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <MantineProvider defaultColorScheme="auto" theme={navyfragenTheme}>
      <Notifications />
      <BrowserRouter>
        <QueryClientProvider client={queryClient}>
          <InstallPromptProvider>
            <AppLayout />
            <ReactQueryDevtools initialIsOpen={false} />
          </InstallPromptProvider>
        </QueryClientProvider>
      </BrowserRouter>
    </MantineProvider>
  </React.StrictMode>
);
