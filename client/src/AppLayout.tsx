import { AppShell, Container, Paper, Text, Title } from "@mantine/core";
import { showNotification } from "@mantine/notifications";
import React, { useEffect, useRef } from "react";
import { Route, Routes } from "react-router-dom";

import { useSwitchAccount } from "./api/authService";
import { AppHeader } from "./components/AppHeader";
import { BouncingLogos } from "./components/BouncingLogos";
import { buildAccountSwitchUrl, consumeAccountSwitchToast } from "./lib/accountSwitchToast";
import { consumeNotificationSwitchRequest } from "./lib/notificationSwitch";
import { Navigation } from "./Navigation";
import Home from "./pages/Home";
import Login from "./pages/Login";
import Messages from "./pages/Messages";
import OAuthCallback from "./pages/OAuthCallback";
import PublicProfile from "./pages/PublicProfile";
import Settings from "./pages/Settings";

export function AppLayout() {
  const [navOpen, setNavOpen] = React.useState(false);

  const navbarRef = useRef<HTMLDivElement>(null);
  const burgerRef = useRef<HTMLButtonElement>(null);
  const { mutate: switchAccount } = useSwitchAccount();

  useEffect(() => {
    const notifyRequest = consumeNotificationSwitchRequest();
    if (notifyRequest) {
      switchAccount(
        { did: notifyRequest.did },
        {
          onSuccess: () => {
            window.location.href = notifyRequest.handle
              ? buildAccountSwitchUrl(notifyRequest.handle)
              : window.location.href;
          },
        }
      );
      return;
    }

    consumeAccountSwitchToast((message) => {
      showNotification({ message, color: "green" });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Close the mobile navbar when the user clicks outside it
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        navOpen &&
        navbarRef.current &&
        !navbarRef.current.contains(event.target as Node) &&
        burgerRef.current &&
        !burgerRef.current.contains(event.target as Node)
      ) {
        setNavOpen(false);
      }
    };

    if (navOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [navOpen]);

  return (
    <>
      <BouncingLogos />
      <div className="app-shell-boundary">
        <AppShell
          header={{ height: 60 }}
          navbar={{
            width: 250,
            breakpoint: "sm",
            collapsed: { mobile: !navOpen, desktop: false },
          }}
          padding="md"
        >
          <AppShell.Header>
            <AppHeader
              opened={navOpen}
              onBurgerToggle={() => setNavOpen((o) => !o)}
              burgerRef={burgerRef as React.RefObject<HTMLButtonElement>}
              onNavClose={() => setNavOpen(false)}
            />
          </AppShell.Header>

          <AppShell.Navbar ref={navbarRef} p="md" style={{ overflow: "hidden" }}>
            <Navigation onLinkClick={() => setNavOpen(false)} />
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
                <Route path="*" element={<NotFoundPage />} />
              </Routes>
            </Container>
          </AppShell.Main>
        </AppShell>
      </div>
    </>
  );
}

function NotFoundPage() {
  return (
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
  );
}
