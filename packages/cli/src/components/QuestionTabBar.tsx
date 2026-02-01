import React from "react";
import { Box, Text, useInput } from "ink";
import type { QuestionExecutionState } from "@open-debate/core";
import { theme } from "../theme.js";

const isTTY = process.stdin.isTTY;

interface QuestionTabBarProps {
  questionStates: QuestionExecutionState[];
  activeIndex: number;
  onSwitch: (index: number) => void;
  totalRounds: number;
}

function TabBarInput({
  questionStates,
  activeIndex,
  onSwitch,
}: {
  questionStates: QuestionExecutionState[];
  activeIndex: number;
  onSwitch: (index: number) => void;
}) {
  useInput((input, key) => {
    // Number keys 1-9 to jump to question
    const num = parseInt(input, 10);
    if (num >= 1 && num <= 9 && num <= questionStates.length) {
      onSwitch(num - 1);
      return;
    }

    // Tab key to cycle forward through questions
    if (input === "\t") {
      const nextIndex = (activeIndex + 1) % questionStates.length;
      onSwitch(nextIndex);
      return;
    }

    // Arrow keys to navigate
    if (key.leftArrow && activeIndex > 0) {
      onSwitch(activeIndex - 1);
    } else if (key.rightArrow && activeIndex < questionStates.length - 1) {
      onSwitch(activeIndex + 1);
    }
  });
  return null;
}

function getStatusText(
  state: QuestionExecutionState,
  totalRounds: number
): { text: string; color: string } {
  switch (state.status) {
    case "pending":
      return { text: "--", color: theme.dim };
    case "debating":
      return {
        text: `${state.currentRound}/${totalRounds}`,
        color: theme.accent,
      };
    case "judging":
      return { text: "*", color: "yellow" };
    case "complete":
      return { text: "Done", color: theme.success };
  }
}

export function QuestionTabBar({
  questionStates,
  activeIndex,
  onSwitch,
  totalRounds,
}: QuestionTabBarProps) {
  if (questionStates.length === 0) {
    return null;
  }

  return (
    <>
      {isTTY && (
        <TabBarInput
          questionStates={questionStates}
          activeIndex={activeIndex}
          onSwitch={onSwitch}
        />
      )}
      <Box marginBottom={1}>
        <Text dimColor>[1-{questionStates.length}] </Text>
        {questionStates.map((state, index) => {
          const isActive = index === activeIndex;
          const { text, color } = getStatusText(state, totalRounds);

          return (
            <React.Fragment key={state.questionIndex}>
              <Text
                backgroundColor={isActive ? "blue" : undefined}
                color={isActive ? "white" : undefined}
              >
                {isActive ? " " : ""}Q{index + 1}{" "}
                <Text
                  color={isActive ? "white" : color}
                  bold={isActive}
                >
                  {text}
                </Text>
                {isActive ? " " : ""}
              </Text>
              {index < questionStates.length - 1 && (
                <Text dimColor> | </Text>
              )}
            </React.Fragment>
          );
        })}
      </Box>
    </>
  );
}
