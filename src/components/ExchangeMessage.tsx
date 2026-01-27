import React from "react";
import { Box, Text } from "ink";
import type { Exchange } from "../types/debate.js";

interface ExchangeMessageProps {
  exchange: Exchange;
  speaker1Id: string;
  maxChars?: number;
}

export function ExchangeMessage({ exchange, speaker1Id, maxChars = 300 }: ExchangeMessageProps) {
  const isFirstSpeaker = exchange.speakerId === speaker1Id;
  const color = isFirstSpeaker ? "blue" : "magenta";

  // Truncate long messages to bound vertical space
  const message = exchange.message.length > maxChars
    ? exchange.message.slice(0, maxChars) + "..."
    : exchange.message;

  return (
    <Box flexDirection="column" marginBottom={1}>
      <Text bold color={color}>
        {exchange.speakerName} (Round {exchange.roundNumber})
      </Text>
      <Box marginLeft={2}>
        <Text wrap="wrap">{message}</Text>
      </Box>
    </Box>
  );
}
