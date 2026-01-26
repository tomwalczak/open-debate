import React from "react";
import { Box, Text } from "ink";
import type { QuestionExecutionState } from "../types/debate.js";
import { Spinner } from "./Spinner.js";

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
  const { questionIndex, question, status, currentRound, currentSpeakerId, streamingText, verdict } = state;

  const truncatedQuestion = question.length > 40 ? question.slice(0, 37) + "..." : question;
  const currentSpeakerName = currentSpeakerId === speaker1Id ? speaker1Name : speaker2Name;
  const speakerColor = currentSpeakerId === speaker1Id ? "blue" : "magenta";

  const getStatusIndicator = () => {
    switch (status) {
      case "pending":
        return <Text color="gray">Waiting...</Text>;
      case "debating":
        return (
          <Text color="yellow">
            R{currentRound}/{totalRounds}
          </Text>
        );
      case "judging":
        return <Text color="cyan">Judging...</Text>;
      case "complete":
        return <Text color="green">Done</Text>;
    }
  };

  // Show last ~3 lines of streaming text (roughly 180 chars at 60 chars/line)
  const truncatedStream = streamingText.length > 180
    ? "..." + streamingText.slice(-180).replace(/^\S*\s/, "")
    : streamingText;

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={status === "complete" ? "green" : status === "judging" ? "cyan" : "yellow"}
      paddingX={1}
      marginBottom={1}
    >
      {/* Question header */}
      <Box justifyContent="space-between">
        <Text bold>
          Q{questionIndex + 1}: "{truncatedQuestion}"
        </Text>
        {getStatusIndicator()}
      </Box>

      {/* Content based on status */}
      {status === "debating" && currentSpeakerId && (
        <Box flexDirection="column" marginTop={1}>
          <Box>
            <Text color={speakerColor} bold>
              {currentSpeakerName}:{" "}
            </Text>
            {streamingText && <Spinner />}
          </Box>
          <Text wrap="wrap" dimColor={!streamingText}>
            {truncatedStream || "thinking..."}
          </Text>
        </Box>
      )}

      {status === "judging" && (
        <Box marginTop={1}>
          <Spinner label="Judge evaluating..." />
        </Box>
      )}

      {status === "complete" && verdict && (
        <Box marginTop={1}>
          <Text color="green">Winner: </Text>
          <Text bold color={verdict.winnerId === speaker1Id ? "blue" : "magenta"}>
            {verdict.winnerId === speaker1Id ? speaker1Name : speaker2Name}
          </Text>
        </Box>
      )}
    </Box>
  );
}
