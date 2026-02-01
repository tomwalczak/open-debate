import React, { useState } from "react";
import { Box, Text, useInput } from "ink";
import TextInput from "ink-text-input";
import type { Exchange } from "@open-debate/core";
import { theme } from "../theme.js";

interface HumanDebateInputProps {
  roundNumber: number;
  totalRounds: number;
  question: string;
  speakerName: string;
  speakerId: string;
  exchanges: Exchange[];
  onSubmit: (response: string) => void;
}

export function HumanDebateInput({
  roundNumber,
  totalRounds,
  question,
  speakerName,
  speakerId,
  exchanges,
  onSubmit,
}: HumanDebateInputProps) {
  const [response, setResponse] = useState("");
  const [isMultiline, setIsMultiline] = useState(false);
  const [lines, setLines] = useState<string[]>([""]);
  const [currentLineIndex, setCurrentLineIndex] = useState(0);

  // Handle keyboard input for multiline mode
  useInput((input, key) => {
    if (!isMultiline) return;

    if (key.return && !key.shift) {
      // Enter without shift - add new line
      const newLines = [...lines];
      newLines.splice(currentLineIndex + 1, 0, "");
      setLines(newLines);
      setCurrentLineIndex(currentLineIndex + 1);
    } else if (key.upArrow) {
      if (currentLineIndex > 0) {
        setCurrentLineIndex(currentLineIndex - 1);
      }
    } else if (key.downArrow) {
      if (currentLineIndex < lines.length - 1) {
        setCurrentLineIndex(currentLineIndex + 1);
      }
    } else if (key.backspace && lines[currentLineIndex] === "" && currentLineIndex > 0) {
      // Delete empty line
      const newLines = lines.filter((_, i) => i !== currentLineIndex);
      setLines(newLines);
      setCurrentLineIndex(currentLineIndex - 1);
    }
  });

  const handleLineChange = (value: string) => {
    if (isMultiline) {
      const newLines = [...lines];
      newLines[currentLineIndex] = value;
      setLines(newLines);
    } else {
      setResponse(value);
    }
  };

  const handleSubmit = () => {
    const finalResponse = isMultiline ? lines.join("\n") : response;
    if (finalResponse.trim()) {
      onSubmit(finalResponse.trim());
    }
  };

  return (
    <Box flexDirection="column" gap={1} paddingX={1}>
      <Box borderStyle="single" borderColor="cyan" paddingX={1}>
        <Text bold color="cyan">Your Turn - Round {roundNumber}/{totalRounds}</Text>
      </Box>

      <Text wrap="wrap" dimColor>
        <Text bold>Question:</Text> {question}
      </Text>

      {/* Full transcript */}
      {exchanges.length > 0 && (
        <Box flexDirection="column" marginTop={1} borderStyle="single" borderColor="gray" paddingX={1} paddingY={1}>
          <Text bold dimColor>Transcript:</Text>
          {exchanges.map((ex, i) => {
            const isHuman = ex.speakerId === speakerId;
            const color = isHuman ? theme.speaker1 : theme.speaker2;
            return (
              <Box key={ex.id} flexDirection="column" marginTop={i > 0 ? 1 : 0}>
                <Text bold color={color}>
                  {ex.speakerName} (Round {ex.roundNumber}):
                </Text>
                <Box marginLeft={2}>
                  <Text wrap="wrap">{ex.message}</Text>
                </Box>
              </Box>
            );
          })}
        </Box>
      )}

      <Box marginTop={1} flexDirection="column">
        <Text>
          Respond as <Text bold color={theme.speaker1}>{speakerName}</Text>:
        </Text>
        <Text dimColor italic>
          (AI partner will expand notes or use polished responses as-is)
        </Text>
      </Box>

      <Box marginTop={1}>
        <Text color="green">&gt; </Text>
        <TextInput
          value={isMultiline ? lines[currentLineIndex] : response}
          onChange={handleLineChange}
          onSubmit={handleSubmit}
          placeholder="Type your argument and press Enter to submit..."
        />
      </Box>

      {isMultiline && lines.length > 1 && (
        <Box flexDirection="column" marginLeft={2}>
          {lines.map((line, i) => (
            i !== currentLineIndex && (
              <Text key={i} dimColor>{line || "(empty line)"}</Text>
            )
          ))}
        </Box>
      )}
    </Box>
  );
}
