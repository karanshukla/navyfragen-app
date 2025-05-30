import React, { useState } from "react"; // Added useState
import ReactDOM from "react-dom/client";
import {
  AppShell,
  Burger,
  createTheme,
  MantineProvider,
  Group,
  Title,
  Container,
  Flex,
  NavLink,
  Avatar,
  Text,
  Menu,
  Button,
  useMantineColorScheme,
  Box,
  Loader, // Added Checkbox if not already present
  Alert, // Added Alert for page-level notifications
} from "@mantine/core";
import {
  BrowserRouter,
  Routes,
  Route,
  Link,
  useLocation,
} from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { queryClient } from "./api/queryClient";
import { useSession, useLogout } from "./api/authService";
import Home from "./pages/Home";
import Login from "./pages/Login";
import Messages from "./pages/Messages";
import PublicProfile from "./pages/PublicProfile";
import { ConfirmationModal } from "./components/ConfirmationModal"; // Added ConfirmationModal
import "@mantine/core/styles.css";
import {
  IconMoon,
  IconHome,
  IconMessage,
  IconLogin,
  IconUser,
  IconLogout,
  IconTrash,
  IconSettings, // Example, if needed for other items
} from "@tabler/icons-react";

const theme = createTheme({
  colors: {
    deepBlue: [
      "#eef3ff",
      "#dce4f5",
      "#b9c7e2",
      "#94a8d0",
      "#748dc1",
      "#5f7cb8",
      "#5474b4",
      "#44639f",
      "#39588f",
      "#2d4b81",
    ],
    blue: [
      "#eef3ff",
      "#dee2f2",
      "#bdc2de",
      "#98a0ca",
      "#7a84ba",
      "#6672b0",
      "#5c68ac",
      "#4c5897",
      "#424e88",
      "#364379",
    ],
  },

  shadows: {
    md: "1px 1px 3px rgba(0, 0, 0, .25)",
    xl: "5px 5px 3px rgba(0, 0, 0, .25)",
  },

  primaryColor: "deepBlue",
  defaultRadius: "md",
  fontFamily: "Inter, sans-serif",
  headings: { fontFamily: "Inter, sans-serif" },
});

// Probably want to move this to Zustand or React Query later
interface UserProfile {
  did?: string;
  displayName?: string;
  description?: string;
  avatar?: string;
}

interface NavigationProps {
  onLinkClick?: () => void;
  isLoggedIn: boolean;
  userProfile: UserProfile | null;
}

function Navigation({ onLinkClick, isLoggedIn }: NavigationProps) {
  const location = useLocation();

  const handleClick = () => {
    if (onLinkClick) {
      onLinkClick();
    }
  };

  return (
    <>
      <NavLink
        label="Home"
        component={Link}
        to="/"
        active={location.pathname === "/"}
        onClick={handleClick}
        leftSection={<IconHome size="1rem" stroke={1.5} />}
      />{" "}
      {isLoggedIn ? (
        <>
          {" "}
          <NavLink
            label="Messages"
            component={Link}
            to="/messages"
            active={location.pathname === "/messages"}
            onClick={handleClick}
            leftSection={<IconMessage size="1rem" stroke={1.5} />}
          />{" "}
        </>
      ) : (
        <>
          <NavLink
            label="Login"
            component={Link}
            to="/login"
            active={location.pathname === "/login"}
            onClick={handleClick}
            leftSection={<IconLogin size="1rem" stroke={1.5} />}
          />
        </>
      )}
    </>
  );
}

// Alert interface for page-level notifications
interface PageAlert {
  title: string;
  message: React.ReactNode;
  color: "red" | "green" | "blue" | "yellow";
}

// App layout component
function AppLayout() {
  const [opened, setOpened] = React.useState(false);
  const [deleteModalOpened, setDeleteModalOpened] = useState(false);
  const [pageAlert, setPageAlert] = useState<PageAlert | null>(null); // Added for page-level alerts
  const { data: sessionData, isLoading } = useSession();
  const { mutate: logout } = useLogout();
  const { toggleColorScheme } = useMantineColorScheme();

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
                max-width: 75vw !important;
              }
            `}
          </style>
          <Burger
            opened={opened}
            onClick={() => setOpened((o) => !o)}
            hiddenFrom="sm"
            size="sm"
          />
          <Button size="xs" variant="subtle" component={Link} to="/">
            <Title order={3}>Navyfragen</Title>
          </Button>
          <Flex
            gap="sm"
            justify="flex-end"
            align="center"
            style={{ flexGrow: 1 }}
          >
            <Button size="xs" onClick={() => toggleColorScheme()}>
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
                        logout();
                      } catch (e) {
                        console.error("Logout failed", e);
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
                variant="outline"
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
      <AppShell.Navbar p="md">
        <Box
          style={{ display: "flex", flexDirection: "column", height: "100%" }}
        >
          <Box>
            <Navigation
              onLinkClick={() => setOpened(false)}
              isLoggedIn={isLoggedIn}
              userProfile={userProfile || null}
            />
          </Box>
          {isLoggedIn && (
            <Box mt="auto">
              <NavLink
                label="Delete My Data"
                onClick={() => setDeleteModalOpened(true)} // Open confirmation modal
                color="red" // Optional: style differently to indicate a destructive action
                leftSection={<IconTrash size="1rem" stroke={1.5} />}
              />
            </Box>
          )}
        </Box>
      </AppShell.Navbar>{" "}
      <AppShell.Main pt={70}>
        <Container>
          {/* Page-level alert */}
          {pageAlert && (
            <Alert
              title={pageAlert.title}
              color={pageAlert.color}
              withCloseButton
              onClose={() => setPageAlert(null)}
              mb="lg"
              style={{
                position: "fixed",
                top: "80px",
                right: "20px",
                zIndex: 1000,
              }}
            >
              {pageAlert.message}
            </Alert>
          )}
          <Routes>
            {" "}
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login />} />
            <Route path="/messages" element={<Messages />} />
            <Route path="/profile" element={<PublicProfile />} />
            <Route path="/profile/:handle" element={<PublicProfile />} />
          </Routes>
        </Container>
      </AppShell.Main>
      <ConfirmationModal
        opened={deleteModalOpened}
        onClose={() => setDeleteModalOpened(false)}
        onConfirm={async () => {
          try {
            const { apiClient } = await import("./api/apiClient");
            await apiClient.delete("/delete-account");
            setPageAlert({
              // MODIFIED
              title: "Success",
              message: "Your data has been deleted.",
              color: "green",
            });
            // No redirect here, user sees the alert, then can navigate
            // window.location.href = "/";
          } catch (e: any) {
            setPageAlert({
              // MODIFIED
              title: "Error",
              message: e.error || "Failed to delete data.",
              color: "red",
            });
          }
          setDeleteModalOpened(false); // Close modal
          // setOpened(false); // Close navbar on click - this was likely a bug, setOpened is for the navbar burger
        }}
        title="Delete Account"
        message="Are you sure you want to delete your account and all data? This cannot be undone."
        confirmLabel="Delete"
      />
    </AppShell>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <MantineProvider defaultColorScheme="auto" theme={theme}>
      {/* REMOVE: <Notifications ... /> */}
      <BrowserRouter>
        <QueryClientProvider client={queryClient}>
          <AppLayout />
          <ReactQueryDevtools initialIsOpen={false} />
        </QueryClientProvider>
      </BrowserRouter>
    </MantineProvider>
  </React.StrictMode>
);
