import React, { memo } from "react";
import { Box, Text } from "ink";
import type { Exchange } from "@open-debate/core";
import { theme } from "../theme.js";

interface ExchangeMessageProps {
  exchange: Exchange;
  speaker1Id: string;
}

export const ExchangeMessage = memo(function ExchangeMessage({ exchange, speaker1Id }: ExchangeMessageProps) {
  const isFirstSpeaker = exchange.speakerId === speaker1Id;
  const color = isFirstSpeaker ? theme.speaker1 : theme.speaker2;

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
});
