import React, { useState, useEffect, useRef } from "react";
import ReactDOM from "react-dom/client";
import {
  AppShell,
  Burger,
  MantineProvider,
  Group,
  Title,
  Container,
  Flex,
  Avatar,
  Text,
  Menu,
  Button,
  useMantineColorScheme,
  Box,
  Loader,
  Paper,
} from "@mantine/core";
import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { queryClient } from "./api/queryClient";
import { useSession, useLogout } from "./api/authService";
import Home from "./pages/Home";
import Login from "./pages/Login";
import Messages from "./pages/Messages";
import Settings from "./pages/Settings";
import PublicProfile from "./pages/PublicProfile";
import OAuthCallback from "./pages/OAuthCallback";
import "@mantine/core/styles.css";
import { IconMoon, IconUser, IconLogout, IconTrash } from "@tabler/icons-react";
import { Notifications } from "@mantine/notifications";
import navyfragenTheme from "./Theme";
import { Navigation } from "./Navigation";
import { InstallPromptProvider } from "./components/InstallPromptContext";

// App layout component
function AppLayout() {
  const [opened, setOpened] = React.useState(false);
  const { data: sessionData, isLoading } = useSession();
  const { mutate: logout } = useLogout();
  const { toggleColorScheme } = useMantineColorScheme();

  const navbarRef = useRef<HTMLDivElement>(null);
  const burgerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        opened && // Only run if the menu is currently open
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
  }, [opened]); // Dependency array ensures this runs when `opened` changes

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
          <style>
            {`
              .mantine-AppShell-navbar {
                max-width: 60vw !important;
              }
            `}
          </style>
          <Burger
            ref={burgerRef}
            opened={opened}
            onClick={() => setOpened((o) => !o)}
            hiddenFrom="sm"
            size="sm"
          />
          <Button size="xs" component={Link} to="/">
            <Title order={3}>Navyfragen</Title>
          </Button>
          <Flex
            gap="sm"
            justify="flex-end"
            align="center"
            style={{ flexGrow: 1 }}
          >
            <Button
              size="xs"
              variant="outline"
              onClick={() => toggleColorScheme()}
            >
              <IconMoon />
            </Button>
            {isLoading ? (
              <Loader size="sm" />
            ) : isLoggedIn && userProfile ? (
              <Menu shadow="md" width={200}>
                <Menu.Target>
                  <Button variant="outline">
                    <Group gap="xs">
                      <Avatar
                        size={30}
                        src={userProfile.avatar || undefined}
                        alt={userProfile.displayName || "User Avatar"}
                      />
                      {/* Hide display name text on xs screens */}
                      <Box visibleFrom="sm">
                        <Text size="sm" truncate>
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
                    leftSection={<IconUser size="1rem" stroke={1.5} />}
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
                    leftSection={<IconLogout size="1rem" stroke={1.5} />}
                  >
                    Logout
                  </Menu.Item>
                </Menu.Dropdown>
              </Menu>
            ) : (
              <Button
                variant="solid"
                component={Link}
                to="/login"
                onClick={() => setOpened(false)}
              >
                Login
              </Button>
            )}
          </Flex>
        </Group>
      </AppShell.Header>
      <AppShell.Navbar ref={navbarRef} p="md">
        <Box
          style={{ display: "flex", flexDirection: "column", height: "100%" }}
        >
          <Navigation
            onLinkClick={() => setOpened(false)}
            isLoggedIn={isLoggedIn}
          />
        </Box>
      </AppShell.Navbar>{" "}
      <AppShell.Main pt={70}>
        <Container>
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
                <>
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
                </>
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
