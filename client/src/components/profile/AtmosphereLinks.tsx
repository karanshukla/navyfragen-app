import { ActionIcon, Box, Group, Menu, Tooltip } from "@mantine/core";
import { IconWorld } from "@tabler/icons-react";

import { useTranslations } from "../../lib/i18n";
import type { AtmosphereApp } from "../../lib/atmosphereApps";

import * as styles from "./AtmosphereLinks.styles";

/**
 * How many marks fit in the row's right corner opposite the profile pill and
 * its copy/share buttons, on the narrowest phone. The rest move into a menu
 * rather than wrapping, so the row keeps one height for every account.
 */
const INLINE_LIMIT = 4;

interface AtmosphereLinksProps {
  apps: AtmosphereApp[];
}

/** The catalog's brand mark, or a neutral one for an app it does not carry. */
function AppMark({ app }: { app: AtmosphereApp }) {
  return (
    <Box className="ds-atmosphere-mark" style={styles.mark}>
      {app.icon ?? <IconWorld size={16} />}
    </Box>
  );
}

/**
 * The other Atmosphere apps this account publishes to, as a row of marks in the
 * profile URL bar.
 *
 * Renders nothing at all when there are none, which is most accounts — the row
 * it sits in must look exactly as it did before rather than reserve a gap.
 *
 * @see [AtmosphereLinks.test.tsx](../../tests/components/AtmosphereLinks.test.tsx):
 * pins the empty case and the point at which the overflow menu appears.
 */
export function AtmosphereLinks({ apps }: AtmosphereLinksProps) {
  const messages = useTranslations();
  if (apps.length === 0) return null;

  const inline = apps.slice(0, INLINE_LIMIT);
  const overflow = apps.slice(INLINE_LIMIT);

  return (
    <Group gap={4} align="center" aria-label={messages.profileUrlBar.atmosphereLinksLabel}>
      {inline.map((app) => (
        <Tooltip key={app.id} label={app.name} withArrow>
          <ActionIcon
            component="a"
            href={app.url}
            target="_blank"
            rel="noopener noreferrer"
            variant="subtle"
            radius="xl"
            size="md"
            aria-label={messages.profileCard.viewOn(app.name)}
            style={styles.link}
          >
            <AppMark app={app} />
          </ActionIcon>
        </Tooltip>
      ))}

      {overflow.length > 0 && (
        <Menu position="bottom-end" withArrow>
          <Menu.Target>
            <ActionIcon
              variant="subtle"
              radius="xl"
              size="md"
              aria-label={messages.profileUrlBar.moreAtmosphereApps(overflow.length)}
              style={styles.overflow}
            >
              +{overflow.length}
            </ActionIcon>
          </Menu.Target>
          <Menu.Dropdown>
            {overflow.map((app) => (
              <Menu.Item
                key={app.id}
                component="a"
                href={app.url}
                target="_blank"
                rel="noopener noreferrer"
                leftSection={<AppMark app={app} />}
              >
                {app.name}
              </Menu.Item>
            ))}
          </Menu.Dropdown>
        </Menu>
      )}
    </Group>
  );
}
