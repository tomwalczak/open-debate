import React, { useState, useEffect } from "react";
import { Box, Text } from "ink";
import type { DebateState, QuestionExecutionState } from "../types/debate.js";
import { Spinner } from "./Spinner.js";
import { ProgressBar } from "./ProgressBar.js";
import { FinalTally } from "./FinalTally.js";
import { HumanFeedback } from "./HumanFeedback.js";
import { QuestionTabBar } from "./QuestionTabBar.js";
import { ExpandedQuestionView } from "./ExpandedQuestionView.js";

interface ParallelDebateViewProps {
  state: DebateState;
  questionStates: Map<number, QuestionExecutionState>;
  onHumanFeedback: (feedback: string) => void;
}

export function ParallelDebateView({
  state,
  questionStates,
  onHumanFeedback,
}: ParallelDebateViewProps) {
  const {
    firstSpeaker,
    secondSpeaker,
    config,
    currentPhase,
    finalTally,
  } = state;

  // Selected question index for tabbed view
  const [selectedQuestionIndex, setSelectedQuestionIndex] = useState(0);

  // Convert map to sorted array
  const sortedQuestionStates = Array.from(questionStates.values()).sort(
    (a, b) => a.questionIndex - b.questionIndex
  );

  // Auto-select first active question when selection becomes invalid or pending
  useEffect(() => {
    if (sortedQuestionStates.length === 0) return;

    const currentSelected = sortedQuestionStates[selectedQuestionIndex];

    // If current selection is valid and not pending, keep it
    if (currentSelected && currentSelected.status !== "pending") return;

    // Find first active (debating/judging) question
    const firstActiveIndex = sortedQuestionStates.findIndex(
      (qs) => qs.status === "debating" || qs.status === "judging"
    );

    if (firstActiveIndex !== -1 && firstActiveIndex !== selectedQuestionIndex) {
      setSelectedQuestionIndex(firstActiveIndex);
    }
  }, [sortedQuestionStates, selectedQuestionIndex]);

  // Calculate overall progress
  const totalExchanges = config.questions.length * config.roundsPerQuestion * 2;
  const completedExchanges = sortedQuestionStates.reduce(
    (sum, qs) => sum + qs.exchanges.length,
    0
  );

  // Count completed questions for header
  const completedCount = sortedQuestionStates.filter(
    (qs) => qs.status === "complete"
  ).length;
  const totalQuestions = config.questions.length;

  return (
    <Box flexDirection="column" padding={1}>
      {/* Header */}
      <Box
        borderStyle="round"
        borderColor="cyan"
        paddingX={2}
        marginBottom={1}
        justifyContent="space-between"
      >
        <Text bold>
          <Text color="blue">{firstSpeaker.name}</Text>
          <Text> vs </Text>
          <Text color="magenta">{secondSpeaker.name}</Text>
        </Text>
        <Text color="gray">
          {completedCount}/{totalQuestions} done
        </Text>
      </Box>

      {/* Progress */}
      <ProgressBar
        current={completedExchanges}
        total={totalExchanges}
        label="Progress:"
      />

      {/* Question Tab Bar and Expanded View */}
      {sortedQuestionStates.length > 0 && (
        <Box flexDirection="column" marginTop={1}>
          <QuestionTabBar
            questionStates={sortedQuestionStates}
            activeIndex={selectedQuestionIndex}
            onSwitch={setSelectedQuestionIndex}
            totalRounds={config.roundsPerQuestion}
          />
          {sortedQuestionStates[selectedQuestionIndex] && (
            <ExpandedQuestionView
              state={sortedQuestionStates[selectedQuestionIndex]}
              speaker1Id={firstSpeaker.id}
              speaker1Name={firstSpeaker.name}
              speaker2Name={secondSpeaker.name}
              totalRounds={config.roundsPerQuestion}
              totalQuestions={totalQuestions}
            />
          )}
        </Box>
      )}

      {/* Learning indicator */}
      {currentPhase === "learning" && (
        <Box marginTop={1}>
          <Spinner label="Agents are learning from debate..." />
        </Box>
      )}

      {/* Final tally */}
      {finalTally && (
        <FinalTally
          tally={finalTally}
          speaker1Name={firstSpeaker.name}
          speaker2Name={secondSpeaker.name}
        />
      )}

      {/* Human feedback input */}
      {currentPhase === "human_feedback" && finalTally && (
        <HumanFeedback
          loserName={
            finalTally.speaker1Wins < finalTally.speaker2Wins
              ? firstSpeaker.name
              : secondSpeaker.name
          }
          onSubmit={onHumanFeedback}
        />
      )}

      {/* Complete */}
      {currentPhase === "complete" && (
        <Box flexDirection="column" marginTop={1}>
          <Text color="green" bold>
            Debate complete! Agents updated.
          </Text>
          <Text color="gray">
            Logs saved to logs/{state.id}/
          </Text>
        </Box>
      )}

      {/* Error */}
      {state.error && (
        <Box marginTop={1}>
          <Text color="red">Error: {state.error}</Text>
        </Box>
      )}
    </Box>
  );
}
