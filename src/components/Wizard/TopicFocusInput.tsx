import React, { useState } from "react";
import { Box, Text } from "ink";
import TextInput from "ink-text-input";

interface TopicFocusInputProps {
  onComplete: (topics: string[]) => void;
}

export function TopicFocusInput({ onComplete }: TopicFocusInputProps) {
  const [input, setInput] = useState("");

  const handleSubmit = (value: string) => {
    if (!value.trim()) {
      onComplete([]);
    } else {
      const topics = value
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
      onComplete(topics);
    }
  };

  return (
    <Box flexDirection="column" gap={1}>
      <Text bold color="cyan">Topic Focus (optional)</Text>

      <Box>
        <Text color="yellow">Focus areas: </Text>
        <TextInput
          value={input}
          onChange={setInput}
          onSubmit={handleSubmit}
          placeholder="e.g., climate, energy, economics (or press Enter to skip)"
        />
      </Box>

      <Text dimColor>
        Comma-separated list of topics to focus questions on, or press Enter to skip
      </Text>
    </Box>
  );
}
