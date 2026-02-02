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
  const [prompt, setPrompt] = useState("");
  const [isParsing, setIsParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);

  const handleSubmit = async (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return;

    if (onNaturalLanguage && modelId) {
      setIsParsing(true);
      setParseError(null);
      try {
        const config = await parseMatchPrompt(trimmed, modelId);
        if (config.speaker1 && config.speaker2) {
          onNaturalLanguage(config);
          return;
        }
        // Couldn't extract two speakers
        setParseError("Couldn't understand that. Try describing who should debate.");
        setIsParsing(false);
      } catch (error) {
        setParseError("Failed to parse. Try a simpler description.");
        setIsParsing(false);
      }
    }
  };

  if (isParsing) {
    return (
      <Box flexDirection="column" gap={1}>
        <Text bold color={theme.accent}>Setting up your debate...</Text>
        <Spinner label="Understanding your request..." />
      </Box>
    );
  }

  return (
    <Box flexDirection="column" gap={1}>
      <Text bold color={theme.accent}>What would you like to debate?</Text>

      {parseError && (
        <Box marginBottom={1}>
          <Text color="red">{parseError}</Text>
        </Box>
      )}

      <Box>
        <Text color="green">&gt; </Text>
        <TextInput
          value={prompt}
          onChange={setPrompt}
          onSubmit={handleSubmit}
          placeholder="Describe the debate..."
        />
      </Box>

      <Box flexDirection="column" marginTop={1}>
        <Text dimColor>Examples:</Text>
        <Text dimColor>  "should all drugs be legalized"</Text>
        <Text dimColor>  "Eliezer Yudkowsky vs Yann LeCun on AI existential risk"</Text>
        <Text dimColor>  "3 debates between a utilitarian and a deontologist"</Text>
      </Box>
    </Box>
  );
}
