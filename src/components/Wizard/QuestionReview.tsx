import React, { useState } from "react";
import { Box, Text } from "ink";
import TextInput from "ink-text-input";
import { Spinner } from "../Spinner.js";

interface QuestionReviewProps {
  questions: string[];
  isLoading: boolean;
  onApprove: () => void;
  onRefine: (command: string) => void;
}

export function QuestionReview({
  questions,
  isLoading,
  onApprove,
  onRefine,
}: QuestionReviewProps) {
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
      <Text bold color="cyan">Review Debate Questions</Text>

      {isLoading ? (
        <Spinner label="Generating questions..." />
      ) : (
        <Box flexDirection="column" marginY={1}>
          {questions.map((q, i) => (
            <Text key={i}>
              <Text color="green">{i + 1}.</Text> {q}
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
