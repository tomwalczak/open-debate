import React from "react";
import { Box, Text } from "ink";
import type { MatchState, QuestionExecutionState } from "../types/debate.js";
import { Spinner } from "./Spinner.js";
import { ProgressBar } from "./ProgressBar.js";
import { QuestionPanel } from "./QuestionPanel.js";
import { theme } from "../theme.js";

interface MatchViewProps {
  match: MatchState | null;
  currentDebate: number;
  questionStates: Map<number, QuestionExecutionState>;
  phase: "init" | "generating" | "debating" | "judging" | "learning" | "complete";
  debateResults: Array<{ speaker1Wins: number; speaker2Wins: number }>;
}

export function MatchView({
  match,
  currentDebate,
  questionStates,
  phase,
  debateResults,
}: MatchViewProps) {
  if (!match) {
    return (
      <Box padding={1}>
        <Spinner label="Initializing match..." />
      </Box>
    );
  }

  const { config, firstSpeaker, secondSpeaker } = match;
  const totalDebates = config.totalDebates;

  // Convert map to sorted array
  const sortedQuestionStates = Array.from(questionStates.values()).sort(
    (a, b) => a.questionIndex - b.questionIndex
  );

  // Calculate progress for current debate
  const totalExchanges = config.questionsPerDebate * config.roundsPerQuestion * 2;
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

  // Calculate overall match score
  const totalS1Wins = debateResults.reduce((sum, r) => sum + r.speaker1Wins, 0);
  const totalS2Wins = debateResults.reduce((sum, r) => sum + r.speaker2Wins, 0);

  return (
    <Box flexDirection="column" padding={1}>
      {/* Header */}
      <Box
        borderStyle="double"
        borderColor={theme.accent}
        paddingX={2}
        marginBottom={1}
        flexDirection="column"
      >
        <Box justifyContent="space-between">
          <Text bold>
            <Text color={theme.speaker1}>{firstSpeaker.name}</Text>
            <Text dimColor> vs </Text>
            <Text color={theme.speaker2}>{secondSpeaker.name}</Text>
          </Text>
          <Text dimColor>{match.id}</Text>
        </Box>
        <Box justifyContent="space-between" marginTop={1}>
          <Text dimColor>
            Debate {currentDebate}/{totalDebates}
          </Text>
          <Text>
            <Text color={theme.speaker1}>{totalS1Wins}</Text>
            <Text dimColor> - </Text>
            <Text color={theme.speaker2}>{totalS2Wins}</Text>
          </Text>
        </Box>
      </Box>

      {/* Phase indicator */}
      {phase === "generating" && (
        <Box marginBottom={1}>
          <Spinner label="Generating questions..." />
        </Box>
      )}

      {phase === "learning" && (
        <Box marginBottom={1}>
          <Spinner label="Agents reflecting on debate..." />
        </Box>
      )}

      {/* Debate progress */}
      {(phase === "debating" || phase === "judging") && (
        <>
          <ProgressBar
            current={completedExchanges}
            total={totalExchanges}
            label={`Debate ${currentDebate}:`}
          />

          {/* Active Questions */}
          {activeQuestions.length > 0 && (
            <Box flexDirection="column" marginTop={1}>
              <Text bold color={theme.accent}>
                Active ({activeQuestions.length})
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

          {/* Completed Questions */}
          {completedQuestions.length > 0 && (
            <Box flexDirection="column" marginTop={1}>
              <Text bold color={theme.success}>Completed:</Text>
              <Box flexWrap="wrap" marginTop={1}>
                {completedQuestions.map((qs, i) => (
                  <Box key={qs.questionIndex} marginRight={2}>
                    <Text dimColor>
                      Q{qs.questionIndex + 1}{" "}
                      <Text color={qs.verdict?.winnerId === firstSpeaker.id ? theme.speaker1 : theme.speaker2}>
                        🏆 {qs.verdict ? (qs.verdict.winnerId === firstSpeaker.id ? firstSpeaker.name : secondSpeaker.name) : "?"}
                      </Text>
                      {i < completedQuestions.length - 1 ? " |" : ""}
                    </Text>
                  </Box>
                ))}
              </Box>
            </Box>
          )}
        </>
      )}

      {/* Previous debate results */}
      {debateResults.length > 0 && (
        <Box flexDirection="column" marginTop={1} borderStyle="single" borderColor={theme.borderDefault} paddingX={1}>
          <Text dimColor>Previous Debates:</Text>
          {debateResults.map((result, i) => (
            <Text key={i} dimColor>
              Debate {i + 1}: <Text color={theme.speaker1}>{firstSpeaker.name} {result.speaker1Wins}</Text> - <Text color={theme.speaker2}>{result.speaker2Wins} {secondSpeaker.name}</Text>
            </Text>
          ))}
        </Box>
      )}

      {/* Match complete */}
      {phase === "complete" && (
        <Box flexDirection="column" marginTop={1} borderStyle="double" borderColor={theme.success} paddingX={2}>
          <Text bold color={theme.success}>🏆 Match Complete!</Text>
          <Box marginTop={1}>
            <Text>
              Final: <Text color={theme.speaker1} bold>{firstSpeaker.name} {totalS1Wins}</Text> - <Text color={theme.speaker2}>{totalS2Wins} {secondSpeaker.name}</Text>
            </Text>
          </Box>
          <Box marginTop={1}>
            <Text dimColor>Saved to matches/{match.id}/</Text>
          </Box>
        </Box>
      )}
    </Box>
  );
}
