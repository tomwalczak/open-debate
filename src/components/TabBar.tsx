import React, { useEffect } from "react";
import { Box, Text, useInput } from "ink";
import type { DebateState } from "../types/debate.js";

const isTTY = process.stdin.isTTY;

interface TabBarProps {
  debates: DebateState[];
  activeIndex: number;
  onSwitch: (index: number) => void;
}

function TabBarInput({ debates, onSwitch }: { debates: DebateState[]; onSwitch: (index: number) => void }) {
  useInput((input) => {
    const num = parseInt(input, 10);
    if (num >= 1 && num <= 9 && num <= debates.length) {
      onSwitch(num - 1);
    }
  });
  return null;
}

export function TabBar({ debates, activeIndex, onSwitch }: TabBarProps) {
  if (debates.length <= 1) {
    return null;
  }

  return (
    <>
      {isTTY && <TabBarInput debates={debates} onSwitch={onSwitch} />}
      <Box marginBottom={1}>
        {debates.map((debate, index) => {
          const isActive = index === activeIndex;
          const isComplete = debate.currentPhase === "complete";
          const statusIcon = isComplete ? "✓" : "●";
          const statusColor = isComplete ? "green" : "yellow";

          return (
            <Box key={debate.id} marginRight={2}>
              <Text
                backgroundColor={isActive ? "blue" : undefined}
                color={isActive ? "white" : "gray"}
              >
                {" "}
                [{index + 1}] {debate.firstSpeaker.name.substring(0, 10)} vs{" "}
                {debate.secondSpeaker.name.substring(0, 10)}{" "}
                <Text color={statusColor}>{statusIcon}</Text>{" "}
              </Text>
            </Box>
          );
        })}
      </Box>
    </>
  );
}
