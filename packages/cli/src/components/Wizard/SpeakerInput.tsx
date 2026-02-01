import React, { useState } from "react";
import { Box, Text } from "ink";
import TextInput from "ink-text-input";
import { theme } from "../../theme.js";
import { parseMatchPrompt, type ParsedMatchConfig } from "@open-debate/core";
import { Spinner } from "../Spinner.js";

interface SpeakerInputProps {
  onComplete: (speaker1: string, speaker2: string) => void;
  onNaturalLanguage?: (config: ParsedMatchConfig) => void;
  modelId?: string;
}

export function SpeakerInput({ onComplete, onNaturalLanguage, modelId }: SpeakerInputProps) {
  const [speaker1, setSpeaker1] = useState("");
  const [speaker2, setSpeaker2] = useState("");
  const [step, setStep] = useState<1 | 2 | "parsing">(1);
  const [parseError, setParseError] = useState<string | null>(null);

  const handleSubmit = async (value: string) => {
    if (step === 1) {
      const trimmed = value.trim();
      if (!trimmed) return;

      // Always try to parse as natural language first
      if (onNaturalLanguage && modelId) {
        setStep("parsing");
        setParseError(null);
        try {
          const config = await parseMatchPrompt(trimmed, modelId);
          // If we got both speakers, proceed with the match
          if (config.speaker1 && config.speaker2) {
            onNaturalLanguage(config);
            return;
          }
          // If we only got speaker1, use it and continue to speaker2 input
          if (config.speaker1) {
            setSpeaker1(config.speaker1);
            setStep(2);
            return;
          }
          // Couldn't parse anything useful, treat as speaker1 name
          setSpeaker1(trimmed);
          setStep(2);
        } catch (error) {
          // Parse failed, treat input as speaker1 name
          setSpeaker1(trimmed);
          setStep(2);
        }
        return;
      }

      // No NL handler, normal two-speaker flow
      setSpeaker1(trimmed);
      setStep(2);
    } else if (step === 2) {
      if (value.trim()) {
        onComplete(speaker1, value.trim());
      }
    }
  };

  if (step === "parsing") {
    return (
      <Box flexDirection="column" gap={1}>
        <Text bold color={theme.accent}>Setting up your debate...</Text>
        <Spinner label="Parsing your request..." />
      </Box>
    );
  }

  return (
    <Box flexDirection="column" gap={1}>
      <Text bold color={theme.accent}>Who should debate?</Text>

      {parseError && (
        <Text color="red">Error: {parseError}</Text>
      )}

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
        Tip: Enter speaker names, OR describe the whole debate:
      </Text>
      <Text dimColor>
        "5 debates between an atheist and a Catholic about morality"
      </Text>
    </Box>
  );
}
