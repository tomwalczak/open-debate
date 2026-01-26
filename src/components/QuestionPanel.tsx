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

  const truncatedStream = streamingText.length > 50
    ? streamingText.slice(-50).replace(/^\S*\s/, "")
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
        <Box marginTop={1}>
          <Text color={speakerColor} bold>
            {currentSpeakerName}:{" "}
          </Text>
          <Text wrap="wrap">
            {truncatedStream || "thinking..."}
          </Text>
          {streamingText && <Spinner />}
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
            {verdict.winnerName}
          </Text>
        </Box>
      )}
    </Box>
  );
}
