import React from "react";
import { Box, Text } from "ink";

interface TopicProgressProps {
  currentTopic: number;
  totalTopics: number;
  currentTurn: number;
  totalTurns: number;
  topic: string;
}

export function TopicProgress({
  currentTopic,
  totalTopics,
  currentTurn,
  totalTurns,
  topic,
}: TopicProgressProps) {
  return (
    <Box flexDirection="column" marginBottom={1}>
      <Box gap={2}>
        <Text color="cyan">
          Topic {currentTopic + 1}/{totalTopics}
        </Text>
        <Text color="yellow">
          Turn {currentTurn}/{totalTurns}
        </Text>
      </Box>
      <Box marginTop={1}>
        <Text bold wrap="wrap">"{topic}"</Text>
      </Box>
    </Box>
  );
}
