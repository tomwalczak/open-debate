import React, { useState } from "react";
import { Box, Text, useInput } from "ink";

const isTTY = process.stdin.isTTY;

interface CoachToggleProps {
  onComplete: (enabled: boolean) => void;
}

export function CoachToggle({ onComplete }: CoachToggleProps) {
  const [selected, setSelected] = useState(false);

  useInput((input, key) => {
    if (input === "y" || input === "Y") {
      onComplete(true);
    } else if (input === "n" || input === "N" || key.return) {
      onComplete(selected);
    } else if (key.leftArrow || key.rightArrow) {
      setSelected(!selected);
    }
  }, { isActive: isTTY });

  return (
    <Box flexDirection="column" gap={1}>
      <Text bold color="cyan">Enable Human Coaching?</Text>

      <Text>
        After each debate, you can provide feedback to improve the agents.
      </Text>

      <Box gap={2}>
        <Text
          color={!selected ? "green" : "gray"}
          bold={!selected}
        >
          [N] No
        </Text>
        <Text
          color={selected ? "green" : "gray"}
          bold={selected}
        >
          [Y] Yes
        </Text>
      </Box>

      <Text dimColor>
        Press Y/N or use arrow keys and Enter
      </Text>
    </Box>
  );
}
