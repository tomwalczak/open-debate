import React, { useState } from "react";
import { Box, Text, useInput } from "ink";
import TextInput from "ink-text-input";
import type { Exchange, CoachMessage } from "@open-debate/core";
import { theme } from "../theme.js";
import { Spinner } from "./Spinner.js";

interface HumanDebateInputProps {
  roundNumber: number;
  totalRounds: number;
  question: string;
  speakerName: string;
  speakerId: string;
  speakerPersona: string;
  exchanges: Exchange[];
  onSubmit: (response: string) => void;
  onHintRequest: (conversationHistory: CoachMessage[], userRequest?: string) => Promise<string>;
}

export function HumanDebateInput({
  roundNumber,
  totalRounds,
  question,
  speakerName,
  speakerId,
  speakerPersona,
  exchanges,
  onSubmit,
  onHintRequest,
}: HumanDebateInputProps) {
  const [response, setResponse] = useState("");
  const [isMultiline, setIsMultiline] = useState(false);
  const [lines, setLines] = useState<string[]>([""]);
  const [currentLineIndex, setCurrentLineIndex] = useState(0);
  const [coachConversation, setCoachConversation] = useState<CoachMessage[]>([]);
  const [isLoadingHint, setIsLoadingHint] = useState(false);

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

  const handleSubmit = async () => {
    const finalResponse = isMultiline ? lines.join("\n") : response;
    const trimmed = finalResponse.trim();

    if (!trimmed) return;

    // Check for /hint command
    if (trimmed.toLowerCase().startsWith("/hint")) {
      const userRequest = trimmed.slice(5).trim() || undefined;
      setIsLoadingHint(true);
      setResponse("");

      // Add user message to conversation
      const userMessage: CoachMessage = {
        role: "user",
        content: userRequest || "Suggest 3 strong arguments or angles I could use right now.",
      };

      try {
        const hint = await onHintRequest(coachConversation, userRequest);
        // Add both user and coach messages to history
        setCoachConversation(prev => [
          ...prev,
          userMessage,
          { role: "coach", content: hint },
        ]);
      } catch (error) {
        setCoachConversation(prev => [
          ...prev,
          userMessage,
          { role: "coach", content: `Error: ${error}` },
        ]);
      }
      setIsLoadingHint(false);
      return;
    }

    // Normal submission - clear coach conversation for next turn
    setCoachConversation([]);
    onSubmit(trimmed);
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

      {/* Coach conversation */}
      {coachConversation.length > 0 && (
        <Box flexDirection="column" marginTop={1} borderStyle="single" borderColor="magenta" paddingX={1} paddingY={1}>
          <Text bold color="magenta">Coach Session:</Text>
          {coachConversation.map((msg, i) => (
            <Box key={i} flexDirection="column" marginTop={1}>
              <Text bold color={msg.role === "user" ? "cyan" : "magenta"}>
                {msg.role === "user" ? "You:" : "Coach:"}
              </Text>
              <Box marginLeft={2}>
                <Text wrap="wrap">{msg.content}</Text>
              </Box>
            </Box>
          ))}
        </Box>
      )}

      {/* Loading hint */}
      {isLoadingHint && (
        <Box marginTop={1}>
          <Spinner label="Getting coaching advice..." />
        </Box>
      )}

      <Box marginTop={1} flexDirection="column">
        <Text>
          Respond as <Text bold color={theme.speaker1}>{speakerName}</Text>:
        </Text>
        <Text dimColor italic>
          Type <Text color="magenta">/hint</Text> for coaching, or <Text color="magenta">/hint [request]</Text> for specific help
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
