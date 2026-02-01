import React, { useState } from "react";
import { Box, Text } from "ink";
import TextInput from "ink-text-input";
import { theme } from "../../theme.js";

interface SettingsInputProps {
  onComplete: (rounds: number, questionCount: number, debateCount: number) => void;
  defaultRounds?: number;
  defaultQuestions?: number;
  defaultDebates?: number;
}

export function SettingsInput({
  onComplete,
  defaultRounds = 3,
  defaultQuestions = 5,
  defaultDebates = 1,
}: SettingsInputProps) {
  const [rounds, setRounds] = useState(String(defaultRounds));
  const [questions, setQuestions] = useState(String(defaultQuestions));
  const [debates, setDebates] = useState(String(defaultDebates));
  const [step, setStep] = useState<1 | 2 | 3>(1);

  const handleSubmit = (value: string) => {
    if (step === 1) {
      const numRounds = parseInt(value, 10) || defaultRounds;
      setRounds(String(numRounds));
      setStep(2);
    } else if (step === 2) {
      const numQuestions = parseInt(value, 10) || defaultQuestions;
      setQuestions(String(numQuestions));
      setStep(3);
    } else {
      const numRounds = parseInt(rounds, 10) || defaultRounds;
      const numQuestions = parseInt(questions, 10) || defaultQuestions;
      const numDebates = parseInt(value, 10) || defaultDebates;
      onComplete(numRounds, numQuestions, numDebates);
    }
  };

  return (
    <Box flexDirection="column" gap={1}>
      <Text bold color={theme.accent}>Match Settings</Text>

      <Box>
        <Text color={step === 1 ? theme.accent : theme.success}>
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

      {step >= 2 && (
        <Box>
          <Text color={step === 2 ? theme.accent : theme.success}>
            Questions per debate: {step === 2 ? "" : questions}
          </Text>
          {step === 2 && (
            <TextInput
              value={questions}
              onChange={setQuestions}
              onSubmit={handleSubmit}
              placeholder={`Default: ${defaultQuestions}`}
            />
          )}
        </Box>
      )}

      {step === 3 && (
        <Box>
          <Text color={theme.accent}>Number of debates: </Text>
          <TextInput
            value={debates}
            onChange={setDebates}
            onSubmit={handleSubmit}
            placeholder={`Default: ${defaultDebates}`}
          />
        </Box>
      )}

      <Text dimColor>
        Press Enter to use defaults
      </Text>
    </Box>
  );
}
