import React from "react";
import { Box, Text, useInput } from "ink";
import type { TopicExecutionState } from "@open-debate/core";
import { theme } from "../theme.js";

const isTTY = process.stdin.isTTY;

interface TopicTabBarProps {
  topicStates: TopicExecutionState[];
  activeIndex: number;
  onSwitch: (index: number) => void;
  totalTurns: number;
}

function TabBarInput({
  topicStates,
  activeIndex,
  onSwitch,
}: {
  topicStates: TopicExecutionState[];
  activeIndex: number;
  onSwitch: (index: number) => void;
}) {
  useInput((input, key) => {
    // Number keys 1-9 to jump to topic
    const num = parseInt(input, 10);
    if (num >= 1 && num <= 9 && num <= topicStates.length) {
      onSwitch(num - 1);
      return;
    }

    // Tab key to cycle forward through topics
    if (input === "\t") {
      const nextIndex = (activeIndex + 1) % topicStates.length;
      onSwitch(nextIndex);
      return;
    }

    // Arrow keys to navigate
    if (key.leftArrow && activeIndex > 0) {
      onSwitch(activeIndex - 1);
    } else if (key.rightArrow && activeIndex < topicStates.length - 1) {
      onSwitch(activeIndex + 1);
    }
  });
  return null;
}

function getStatusText(
  state: TopicExecutionState,
  totalTurns: number
): { text: string; color: string } {
  switch (state.status) {
    case "pending":
      return { text: "--", color: theme.dim };
    case "debating":
      return {
        text: `${state.currentTurn}/${totalTurns}`,
        color: theme.accent,
      };
    case "judging":
      return { text: "*", color: "yellow" };
    case "complete":
      return { text: "Done", color: theme.success };
  }
}

export function TopicTabBar({
  topicStates,
  activeIndex,
  onSwitch,
  totalTurns,
}: TopicTabBarProps) {
  if (topicStates.length === 0) {
    return null;
  }

  return (
    <>
      {isTTY && (
        <TabBarInput
          topicStates={topicStates}
          activeIndex={activeIndex}
          onSwitch={onSwitch}
        />
      )}
      <Box marginBottom={1}>
        <Text dimColor>[1-{topicStates.length}] </Text>
        {topicStates.map((state, index) => {
          const isActive = index === activeIndex;
          const { text, color } = getStatusText(state, totalTurns);

          return (
            <React.Fragment key={state.topicIndex}>
              <Text
                backgroundColor={isActive ? "blue" : undefined}
                color={isActive ? "white" : undefined}
              >
                {isActive ? " " : ""}T{index + 1}{" "}
                <Text
                  color={isActive ? "white" : color}
                  bold={isActive}
                >
                  {text}
                </Text>
                {isActive ? " " : ""}
              </Text>
              {index < topicStates.length - 1 && (
                <Text dimColor> | </Text>
              )}
            </React.Fragment>
          );
        })}
      </Box>
    </>
  );
}
