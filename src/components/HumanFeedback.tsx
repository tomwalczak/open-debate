import React, { useState } from "react";
import { Box, Text } from "ink";
import TextInput from "ink-text-input";

interface HumanFeedbackProps {
  loserName: string;
  onSubmit: (feedback: string) => void;
}

export function HumanFeedback({ loserName, onSubmit }: HumanFeedbackProps) {
  const [feedback, setFeedback] = useState("");

  const handleSubmit = () => {
    onSubmit(feedback.trim());
  };

  return (
    <Box flexDirection="column" gap={1}>
      <Text bold color="cyan">Human Coach Feedback</Text>

      <Text>
        Provide coaching feedback for <Text color="yellow">{loserName}</Text> to improve their debate performance.
      </Text>

      <Box>
        <Text color="green">&gt; </Text>
        <TextInput
          value={feedback}
          onChange={setFeedback}
          onSubmit={handleSubmit}
          placeholder="Enter feedback (or press Enter to skip)..."
        />
      </Box>

      <Text dimColor>
        Press Enter to submit (leave empty to skip)
      </Text>
    </Box>
  );
}
