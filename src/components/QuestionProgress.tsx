import React from "react";
import { Box, Text } from "ink";

interface QuestionProgressProps {
  currentQuestion: number;
  totalQuestions: number;
  currentRound: number;
  totalRounds: number;
  question: string;
}

export function QuestionProgress({
  currentQuestion,
  totalQuestions,
  currentRound,
  totalRounds,
  question,
}: QuestionProgressProps) {
  return (
    <Box flexDirection="column" marginBottom={1}>
      <Box gap={2}>
        <Text color="cyan">
          Question {currentQuestion + 1}/{totalQuestions}
        </Text>
        <Text color="yellow">
          Round {currentRound}/{totalRounds}
        </Text>
      </Box>
      <Box marginTop={1}>
        <Text bold wrap="wrap">"{question}"</Text>
      </Box>
    </Box>
  );
}
