import React from "react";
import { Box, Text } from "ink";
import type { JudgeVerdict as JudgeVerdictType } from "../types/judge.js";

interface JudgeVerdictProps {
  verdict: JudgeVerdictType;
  questionNumber?: number;
  speaker1Id: string;
  speaker1Name: string;
  speaker2Name: string;
}

export function JudgeVerdict({ verdict, questionNumber, speaker1Id, speaker1Name, speaker2Name }: JudgeVerdictProps) {
  const winnerName = verdict.winnerId === speaker1Id ? speaker1Name : speaker2Name;

  return (
    <Box flexDirection="column" borderStyle="round" borderColor="yellow" paddingX={1} marginY={1}>
      <Text bold color="yellow">
        {questionNumber !== undefined ? `Question ${questionNumber} Verdict` : "Judge's Verdict"}
      </Text>
      <Box marginTop={1}>
        <Text>
          <Text color="green" bold>Winner: </Text>
          <Text>{winnerName}</Text>
        </Text>
      </Box>
      <Box marginTop={1}>
        <Text wrap="wrap">
          <Text color="gray">Reasoning: </Text>
          {verdict.reasoning}
        </Text>
      </Box>
    </Box>
  );
}
