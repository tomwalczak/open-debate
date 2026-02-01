import React from "react";
import { Box, Text, useInput } from "ink";
import { theme } from "../../theme.js";

interface ConfirmStartProps {
  speaker1Name: string;
  speaker2Name: string;
  turns: number;
  topics: number;
  debates: number;
  narrate: boolean;
  onConfirm: () => void;
  onEdit: () => void;
}

export function ConfirmStart({
  speaker1Name,
  speaker2Name,
  turns,
  topics,
  debates,
  narrate,
  onConfirm,
  onEdit,
}: ConfirmStartProps) {
  useInput((input, key) => {
    if (key.return) {
      onConfirm();
    } else if (key.upArrow || input === "e" || input === "E") {
      onEdit();
    }
  });

  return (
    <Box flexDirection="column" gap={1}>
      <Text bold color={theme.accent}>Ready to start?</Text>

      <Box flexDirection="column" marginLeft={2}>
        <Text>
          <Text dimColor>Speakers:</Text> <Text color={theme.speaker1}>{speaker1Name}</Text>
          <Text dimColor> vs </Text>
          <Text color={theme.speaker2}>{speaker2Name}</Text>
        </Text>
        <Text>
          <Text dimColor>Format:</Text> {turns} turns × {topics} topics × {debates} debate{debates > 1 ? "s" : ""}
        </Text>
        <Text>
          <Text dimColor>Narrator:</Text> {narrate ? <Text color={theme.success}>ON</Text> : <Text dimColor>OFF</Text>}
        </Text>
      </Box>

      <Box marginTop={1} flexDirection="column">
        <Text color={theme.accent}>↵ Enter</Text>
        <Text dimColor>  Start debate</Text>
      </Box>
      <Box flexDirection="column">
        <Text dimColor>↑ or E</Text>
        <Text dimColor>  Customize settings</Text>
      </Box>
    </Box>
  );
}
