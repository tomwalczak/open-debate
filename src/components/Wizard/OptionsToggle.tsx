import React, { useState } from "react";
import { Box, Text, useInput } from "ink";
import { theme } from "../../theme.js";

interface OptionsToggleProps {
  onComplete: (narrate: boolean) => void;
  defaultNarrate?: boolean;
}

export function OptionsToggle({ onComplete, defaultNarrate = true }: OptionsToggleProps) {
  const [narrate, setNarrate] = useState(defaultNarrate);

  useInput((input, key) => {
    if (key.return) {
      onComplete(narrate);
    } else if (key.leftArrow || key.rightArrow || input === " ") {
      setNarrate(!narrate);
    }
  });

  return (
    <Box flexDirection="column" gap={1}>
      <Text bold color={theme.accent}>Display Options</Text>

      <Box gap={2}>
        <Text>Narrator mode: </Text>
        <Text color={narrate ? theme.success : theme.dim} bold={narrate}>
          {narrate ? "[ON]" : "[OFF]"}
        </Text>
      </Box>

      <Text dimColor>
        {narrate
          ? "Shows commentary summaries instead of raw debate text"
          : "Shows full streaming debate responses"
        }
      </Text>

      <Text dimColor>
        ← → to toggle, Enter to continue
      </Text>
    </Box>
  );
}
