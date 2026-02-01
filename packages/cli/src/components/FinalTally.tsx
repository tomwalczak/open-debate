import React from "react";
import { Box, Text } from "ink";
import type { FinalTally as FinalTallyType } from "@open-debate/core";

interface FinalTallyProps {
  tally: FinalTallyType;
  speaker1Name: string;
  speaker2Name: string;
}

export function FinalTally({ tally, speaker1Name, speaker2Name }: FinalTallyProps) {
  const winner =
    tally.speaker1Wins > tally.speaker2Wins
      ? speaker1Name
      : tally.speaker2Wins > tally.speaker1Wins
      ? speaker2Name
      : "Tie";

  return (
    <Box flexDirection="column" borderStyle="double" borderColor="green" paddingX={2} marginY={1}>
      <Text bold color="green">Final Results</Text>

      <Box marginTop={1} flexDirection="column">
        <Text>
          <Text color="blue" bold>{speaker1Name}: </Text>
          <Text>{tally.speaker1Wins} wins</Text>
        </Text>
        <Text>
          <Text color="magenta" bold>{speaker2Name}: </Text>
          <Text>{tally.speaker2Wins} wins</Text>
        </Text>
        {tally.ties > 0 && (
          <Text>
            <Text color="gray">Ties: </Text>
            <Text>{tally.ties}</Text>
          </Text>
        )}
      </Box>

      <Box marginTop={1}>
        <Text bold>
          Overall Winner: <Text color="yellow">{winner}</Text>
        </Text>
      </Box>
    </Box>
  );
}
