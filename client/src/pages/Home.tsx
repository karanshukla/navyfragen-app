import {
  Button,
  Container,
  Group,
  List,
  Text,
  ThemeIcon,
  Title,
} from "@mantine/core";

export default function Home() {
  return (
    <Container size="md">
      <Title>Navyfragen - Anonymous questions and answers on BlueSky</Title>
      <Text c="dimmed" mt="md">
        Receive questions from the web and post the answers directly on BlueSky.
      </Text>

      <List
        mt={30}
        spacing="sm"
        size="sm"
        icon={<ThemeIcon size={20} radius="xl"></ThemeIcon>}
      >
        <List.Item>
          <b>Fast and free</b> – No downloads required, just log in with your
          BlueSky credentials and share your inbox link
        </List.Item>
        <List.Item>
          <b>Spam protection, without captchas</b> – Protected by Anubis, a
          powerful bot detection service
        </List.Item>
        <List.Item>
          <b>Open source</b> – Contribute directly to the project, or host your
          own version if you want!
        </List.Item>
      </List>
    </Container>
  );
}
