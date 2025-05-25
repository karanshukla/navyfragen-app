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
  Image,
  rem,
  Button,
} from "@mantine/core";
import { Notifications } from "@mantine/notifications";
import {
  BrowserRouter,
  Routes,
  Route,
  Link,
  useLocation,
} from "react-router-dom";
import Home from "./pages/Home";
import Login from "./pages/Login";
import Status from "./pages/Status";
import "@mantine/core/styles.css";

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

// Navigation wrapper component for active link styling
function Navigation() {
  const location = useLocation();

  return (
    <>
      <NavLink
        label="Home"
        component={Link}
        to="/"
        active={location.pathname === "/"}
      />
      <NavLink
        label="Login"
        component={Link}
        to="/login"
        active={location.pathname === "/login"}
      />
      <NavLink
        label="Status"
        component={Link}
        to="/status"
        active={location.pathname === "/status"}
      />
    </>
  );
}

// App layout component
function AppLayout() {
  const [opened, setOpened] = React.useState(false);

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
          <Group justify="space-between" style={{ flex: 1 }}>
            <Title order={3}>NavyFragen</Title>
            <Group ml="auto" visibleFrom="sm">
              <Navigation />
            </Group>
          </Group>
        </Group>
      </AppShell.Header>
      <AppShell.Navbar p="md">
        <Navigation />
      </AppShell.Navbar>

      <AppShell.Main pt={70}>
        <Container>
          {" "}
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login />} />
            <Route path="/status" element={<Status />} />
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
        <AppLayout />
      </BrowserRouter>
    </MantineProvider>
  </React.StrictMode>
);
