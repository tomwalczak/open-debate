import React, { useState } from "react";
import { Box, Text } from "ink";
import TextInput from "ink-text-input";
import { theme } from "../../theme.js";

interface SettingsInputProps {
  onComplete: (turns: number, topicCount: number, debateCount: number) => void;
  defaultTurns?: number;
  defaultTopics?: number;
  defaultDebates?: number;
}

export function SettingsInput({
  onComplete,
  defaultTurns = 3,
  defaultTopics = 5,
  defaultDebates = 1,
}: SettingsInputProps) {
  const [turns, setTurns] = useState(String(defaultTurns));
  const [topics, setTopics] = useState(String(defaultTopics));
  const [debates, setDebates] = useState(String(defaultDebates));
  const [step, setStep] = useState<1 | 2 | 3>(1);

  const handleSubmit = (value: string) => {
    if (step === 1) {
      const numTurns = parseInt(value, 10) || defaultTurns;
      setTurns(String(numTurns));
      setStep(2);
    } else if (step === 2) {
      const numTopics = parseInt(value, 10) || defaultTopics;
      setTopics(String(numTopics));
      setStep(3);
    } else {
      const numTurns = parseInt(turns, 10) || defaultTurns;
      const numTopics = parseInt(topics, 10) || defaultTopics;
      const numDebates = parseInt(value, 10) || defaultDebates;
      onComplete(numTurns, numTopics, numDebates);
    }
  };

  return (
    <Box flexDirection="column" gap={1}>
      <Text bold color={theme.accent}>Match Settings</Text>

      <Box>
        <Text color={step === 1 ? theme.accent : theme.success}>
          Turns per topic: {step === 1 ? "" : turns}
        </Text>
        {step === 1 && (
          <TextInput
            value={turns}
            onChange={setTurns}
            onSubmit={handleSubmit}
            placeholder={`Default: ${defaultTurns}`}
          />
        )}
      </Box>

      {step >= 2 && (
        <Box>
          <Text color={step === 2 ? theme.accent : theme.success}>
            Topics per debate: {step === 2 ? "" : topics}
          </Text>
          {step === 2 && (
            <TextInput
              value={topics}
              onChange={setTopics}
              onSubmit={handleSubmit}
              placeholder={`Default: ${defaultTopics}`}
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
