import { useEffect, useState } from "react";
import { Button, Container, Title, Text, Group, Card } from "@mantine/core";
import { useNavigate } from "react-router-dom";

type Status = {
  uri: string;
  authorDid: string;
  status: string;
};

type HomeData = {
  statuses: Status[];
  didHandleMap: Record<string, string>;
  isLoggedIn: boolean;
};

export default function Home() {
  const navigate = useNavigate();

  return (
    <Container>
      <Title>NavyFragen</Title>
    </Container>
  );
}
