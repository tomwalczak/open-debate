import React from "react";
import { Box, Text } from "ink";
import type { QuestionExecutionState } from "../types/debate.js";
import { Spinner } from "./Spinner.js";
import { theme } from "../theme.js";

interface QuestionPanelProps {
  state: QuestionExecutionState;
  speaker1Id: string;
  speaker1Name: string;
  speaker2Name: string;
  totalRounds: number;
}

export function QuestionPanel({
  state,
  speaker1Id,
  speaker1Name,
  speaker2Name,
  totalRounds,
}: QuestionPanelProps) {
  const { questionIndex, question, status, currentRound, currentSpeakerId, streamingText, verdict, narratorSummary, isNarratorStreaming } = state;

  const currentSpeakerName = currentSpeakerId === speaker1Id ? speaker1Name : speaker2Name;
  const speakerColor = currentSpeakerId === speaker1Id ? theme.speaker1 : theme.speaker2;

  const getStatusIndicator = () => {
    switch (status) {
      case "pending":
        return <Text dimColor>Waiting...</Text>;
      case "debating":
        return (
          <Text color={theme.accent}>
            R{currentRound}/{totalRounds}
          </Text>
        );
      case "judging":
        return <Text color={theme.accent}>Judging...</Text>;
      case "complete":
        return <Text color={theme.success}>Done</Text>;
    }
  };

  // Show last ~3 lines of streaming text (roughly 180 chars at 60 chars/line)
  const truncatedStream = streamingText.length > 240
    ? "..." + streamingText.slice(-240).replace(/^\S*\s/, "")
    : streamingText;

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={status === "complete" ? theme.borderComplete : status === "debating" ? theme.borderActive : theme.borderDefault}
      paddingX={1}
      marginBottom={1}
    >
      {/* Question header */}
      <Box>
        <Box flexGrow={1} marginRight={1}>
          <Text bold wrap="wrap">
            Q{questionIndex + 1}: "{question}"
          </Text>
        </Box>
        {getStatusIndicator()}
      </Box>

      {/* Content area with fixed height to prevent layout jumping */}
      <Box flexDirection="column" marginTop={1} minHeight={3}>
        {status === "debating" && currentSpeakerId && (
          <>
            {/* Show current activity line */}
            <Box>
              <Text color={speakerColor} bold>
                {currentSpeakerName}:{" "}
              </Text>
              {isNarratorStreaming ? (
                <Spinner />
              ) : streamingText ? (
                <Spinner />
              ) : !narratorSummary ? (
                <Text dimColor>thinking...</Text>
              ) : null}
            </Box>
            {/* Show content: narrator streaming, raw streaming, or persisted summary */}
            {isNarratorStreaming ? (
              <Text wrap="wrap" color={theme.accent}>
                {truncatedStream || "..."}
              </Text>
            ) : streamingText ? (
              <Text wrap="wrap">
                {truncatedStream}
              </Text>
            ) : narratorSummary ? (
              <Text wrap="wrap" color={theme.accent}>
                {narratorSummary}
              </Text>
            ) : null}
          </>
        )}

        {status === "judging" && (
          <Spinner label="Judge evaluating..." />
        )}

        {status === "complete" && verdict && (
          <Box>
            <Text color={theme.success}>🏆 </Text>
            <Text bold color={verdict.winnerId === speaker1Id ? theme.speaker1 : theme.speaker2}>
              {verdict.winnerId === speaker1Id ? speaker1Name : speaker2Name}
            </Text>
          </Box>
        )}

        {status === "pending" && (
          <Text dimColor>Waiting to start...</Text>
        )}
      </Box>
    </Box>
  );
}
