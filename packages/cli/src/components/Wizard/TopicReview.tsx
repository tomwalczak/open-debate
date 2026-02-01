import React, { useState } from "react";
import { Box, Text } from "ink";
import TextInput from "ink-text-input";
import { Spinner } from "../Spinner.js";

interface TopicReviewProps {
  topics: string[];
  isLoading: boolean;
  onApprove: () => void;
  onRefine: (command: string) => void;
}

export function TopicReview({
  topics,
  isLoading,
  onApprove,
  onRefine,
}: TopicReviewProps) {
  const [input, setInput] = useState("");

  const handleSubmit = (value: string) => {
    if (!value.trim()) {
      onApprove();
    } else {
      onRefine(value.trim());
      setInput("");
    }
  };

  return (
    <Box flexDirection="column" gap={1}>
      <Text bold color="cyan">Review Debate Topics</Text>

      {isLoading ? (
        <Spinner label="Generating topics..." />
      ) : (
        <Box flexDirection="column" marginY={1}>
          {topics.map((t, i) => (
            <Text key={i}>
              <Text color="green">{i + 1}.</Text> {t}
            </Text>
          ))}
        </Box>
      )}

      {!isLoading && (
        <>
          <Box>
            <Text color="yellow">Refine: </Text>
            <TextInput
              value={input}
              onChange={setInput}
              onSubmit={handleSubmit}
              placeholder="e.g., 'give me 5 more' or 'make 3 about economics'"
            />
          </Box>

          <Text dimColor>
            Enter a refinement command, or press Enter to approve and continue
          </Text>
        </>
      )}
    </Box>
  );
}
