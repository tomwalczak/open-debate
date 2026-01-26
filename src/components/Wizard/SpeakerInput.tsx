import React, { useState } from "react";
import { Box, Text } from "ink";
import TextInput from "ink-text-input";
import { theme } from "../../theme.js";

interface SpeakerInputProps {
  onComplete: (speaker1: string, speaker2: string) => void;
}

export function SpeakerInput({ onComplete }: SpeakerInputProps) {
  const [speaker1, setSpeaker1] = useState("");
  const [speaker2, setSpeaker2] = useState("");
  const [step, setStep] = useState<1 | 2>(1);

  const handleSubmit = (value: string) => {
    if (step === 1) {
      if (value.trim()) {
        setSpeaker1(value.trim());
        setStep(2);
      }
    } else {
      if (value.trim()) {
        onComplete(speaker1, value.trim());
      }
    }
  };

  return (
    <Box flexDirection="column" gap={1}>
      <Text bold color={theme.accent}>Who should debate?</Text>

      <Box>
        <Text color={step === 1 ? theme.accent : theme.success}>
          Speaker 1: {step === 1 ? "" : speaker1}
        </Text>
        {step === 1 && (
          <TextInput
            value={speaker1}
            onChange={setSpeaker1}
            onSubmit={handleSubmit}
            placeholder="Enter name or persona..."
          />
        )}
      </Box>

      {step === 2 && (
        <Box>
          <Text color={theme.accent}>Speaker 2: </Text>
          <TextInput
            value={speaker2}
            onChange={setSpeaker2}
            onSubmit={handleSubmit}
            placeholder="Enter name or persona..."
          />
        </Box>
      )}

      <Text dimColor>
        Tip: Use real names (e.g., "Alex Epstein") or personas (e.g., "Climate Activist")
      </Text>
    </Box>
  );
}
