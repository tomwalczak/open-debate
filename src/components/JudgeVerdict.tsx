import React from "react";
import { Box, Text } from "ink";
import type { JudgeVerdict as JudgeVerdictType } from "../types/judge.js";

interface JudgeVerdictProps {
  verdict: JudgeVerdictType;
  questionNumber?: number;
}

export function JudgeVerdict({ verdict, questionNumber }: JudgeVerdictProps) {
  return (
    <Box flexDirection="column" borderStyle="round" borderColor="yellow" paddingX={1} marginY={1}>
      <Text bold color="yellow">
        {questionNumber !== undefined ? `Question ${questionNumber} Verdict` : "Judge's Verdict"}
      </Text>
      <Box marginTop={1}>
        <Text>
          <Text color="green" bold>Winner: </Text>
          <Text>{verdict.winnerName}</Text>
        </Text>
      </Box>
      <Box marginTop={1}>
        <Text wrap="wrap">
          <Text color="gray">Reason: </Text>
          {verdict.reason}
        </Text>
      </Box>
    </Box>
  );
}
