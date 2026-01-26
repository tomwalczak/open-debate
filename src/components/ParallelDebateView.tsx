import React from "react";
import { Box, Text } from "ink";
import type { DebateState, QuestionExecutionState } from "../types/debate.js";
import { Spinner } from "./Spinner.js";
import { ProgressBar } from "./ProgressBar.js";
import { QuestionPanel } from "./QuestionPanel.js";
import { FinalTally } from "./FinalTally.js";
import { HumanFeedback } from "./HumanFeedback.js";

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

  // Convert map to sorted array
  const sortedQuestionStates = Array.from(questionStates.values()).sort(
    (a, b) => a.questionIndex - b.questionIndex
  );

  // Calculate overall progress
  const totalExchanges = config.questions.length * config.roundsPerQuestion * 2;
  const completedExchanges = sortedQuestionStates.reduce(
    (sum, qs) => sum + qs.exchanges.length,
    0
  );

  // Separate active and completed questions
  const activeQuestions = sortedQuestionStates.filter(
    (qs) => qs.status === "debating" || qs.status === "judging"
  );
  const completedQuestions = sortedQuestionStates.filter(
    (qs) => qs.status === "complete"
  );
  const pendingQuestions = sortedQuestionStates.filter(
    (qs) => qs.status === "pending"
  );

  const completedCount = completedQuestions.length;
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

      {/* Active Questions */}
      {activeQuestions.length > 0 && (
        <Box flexDirection="column" marginTop={1}>
          <Text bold color="yellow">
            Active Questions ({activeQuestions.length}/{Math.min(5, totalQuestions - completedCount)})
          </Text>
          <Box flexDirection="column" marginTop={1}>
            {activeQuestions.map((qs) => (
              <QuestionPanel
                key={qs.questionIndex}
                state={qs}
                speaker1Id={firstSpeaker.id}
                speaker1Name={firstSpeaker.name}
                speaker2Name={secondSpeaker.name}
                totalRounds={config.roundsPerQuestion}
              />
            ))}
          </Box>
        </Box>
      )}

      {/* Pending indicator */}
      {pendingQuestions.length > 0 && (
        <Box marginTop={1}>
          <Text color="gray">
            Queued: {pendingQuestions.length} question{pendingQuestions.length !== 1 ? "s" : ""} waiting...
          </Text>
        </Box>
      )}

      {/* Completed Questions Summary */}
      {completedQuestions.length > 0 && (
        <Box flexDirection="column" marginTop={1}>
          <Text bold color="green">Completed:</Text>
          <Box flexWrap="wrap" marginTop={1}>
            {completedQuestions.map((qs, i) => (
              <Box key={qs.questionIndex} marginRight={2}>
                <Text>
                  Q{qs.questionIndex + 1}{" "}
                  <Text color={qs.verdict?.winnerId === firstSpeaker.id ? "blue" : "magenta"}>
                    {qs.verdict?.winnerName || "?"}
                  </Text>
                  {i < completedQuestions.length - 1 ? " |" : ""}
                </Text>
              </Box>
            ))}
          </Box>
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
