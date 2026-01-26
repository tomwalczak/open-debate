import React from "react";
import { Box, Text } from "ink";
import type { Exchange } from "../types/debate.js";

interface ExchangeMessageProps {
  exchange: Exchange;
  speaker1Id: string;
}

export function ExchangeMessage({ exchange, speaker1Id }: ExchangeMessageProps) {
  const isFirstSpeaker = exchange.speakerId === speaker1Id;
  const color = isFirstSpeaker ? "blue" : "magenta";

  return (
    <Box flexDirection="column" marginBottom={1}>
      <Text bold color={color}>
        {exchange.speakerName} (Round {exchange.roundNumber})
      </Text>
      <Box marginLeft={2}>
        <Text wrap="wrap">{exchange.message}</Text>
      </Box>
    </Box>
  );
}
