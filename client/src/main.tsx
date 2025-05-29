import React from "react";
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
  Loader,
} from "@mantine/core";
import { Notifications } from "@mantine/notifications";
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
import "@mantine/core/styles.css";
import { IconMoon } from "@tabler/icons-react";

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
          />{" "}
          <NavLink
            label="Delete My Data"
            onClick={async () => {
              if (
                !window.confirm(
                  "Are you sure you want to delete your account and all data? This cannot be undone."
                )
              )
                return;
              try {
                const { apiClient } = await import("./api/apiClient");
                const res = await apiClient.delete("/delete-account");
                alert("Your data has been deleted.");
                window.location.href = "/";
              } catch (e: any) {
                alert(e.error || "Failed to delete data.");
              }
            }}
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
          />
        </>
      )}
    </>
  );
}

// App layout component
function AppLayout() {
  const [opened, setOpened] = React.useState(false);
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
        <Navigation
          onLinkClick={() => setOpened(false)}
          isLoggedIn={isLoggedIn}
          userProfile={userProfile || null}
        />
      </AppShell.Navbar>{" "}
      <AppShell.Main pt={70}>
        <Container>
          {" "}
          <Routes>
            {" "}
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login />} />
            <Route path="/messages" element={<Messages />} />
            <Route path="/profile/:handle" element={<PublicProfile />} />
          </Routes>
        </Container>
      </AppShell.Main>
    </AppShell>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <MantineProvider defaultColorScheme="auto" theme={theme}>
      <Notifications />
      <BrowserRouter>
        <QueryClientProvider client={queryClient}>
          <AppLayout />
          <ReactQueryDevtools initialIsOpen={false} />
        </QueryClientProvider>
      </BrowserRouter>
    </MantineProvider>
  </React.StrictMode>
);
