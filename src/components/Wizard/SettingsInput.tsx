import React, { useState } from "react";
import { Box, Text } from "ink";
import TextInput from "ink-text-input";

interface SettingsInputProps {
  onComplete: (rounds: number, questionCount: number) => void;
  defaultRounds?: number;
  defaultQuestions?: number;
}

export function SettingsInput({
  onComplete,
  defaultRounds = 3,
  defaultQuestions = 5,
}: SettingsInputProps) {
  const [rounds, setRounds] = useState(String(defaultRounds));
  const [questions, setQuestions] = useState(String(defaultQuestions));
  const [step, setStep] = useState<1 | 2>(1);

  const handleSubmit = (value: string) => {
    if (step === 1) {
      const numRounds = parseInt(value, 10) || defaultRounds;
      setRounds(String(numRounds));
      setStep(2);
    } else {
      const numQuestions = parseInt(value, 10) || defaultQuestions;
      const numRounds = parseInt(rounds, 10) || defaultRounds;
      onComplete(numRounds, numQuestions);
    }
  };

  return (
    <Box flexDirection="column" gap={1}>
      <Text bold color="cyan">Debate Settings</Text>

      <Box>
        <Text color={step === 1 ? "yellow" : "green"}>
          Rounds per question: {step === 1 ? "" : rounds}
        </Text>
        {step === 1 && (
          <TextInput
            value={rounds}
            onChange={setRounds}
            onSubmit={handleSubmit}
            placeholder={`Default: ${defaultRounds}`}
          />
        )}
      </Box>

      {step === 2 && (
        <Box>
          <Text color="yellow">Number of questions: </Text>
          <TextInput
            value={questions}
            onChange={setQuestions}
            onSubmit={handleSubmit}
            placeholder={`Default: ${defaultQuestions}`}
          />
        </Box>
      )}

      <Text dimColor>
        Press Enter to use defaults
      </Text>
    </Box>
  );
}
