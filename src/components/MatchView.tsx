import React from "react";
import { Box, Text } from "ink";
import type { MatchState, QuestionExecutionState } from "../types/debate.js";
import { Spinner } from "./Spinner.js";
import { ProgressBar } from "./ProgressBar.js";
import { QuestionPanel } from "./QuestionPanel.js";

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
        borderColor="cyan"
        paddingX={2}
        marginBottom={1}
        flexDirection="column"
      >
        <Box justifyContent="space-between">
          <Text bold>
            <Text color="blue">{firstSpeaker.name}</Text>
            <Text> vs </Text>
            <Text color="magenta">{secondSpeaker.name}</Text>
          </Text>
          <Text color="yellow">Match: {match.id}</Text>
        </Box>
        <Box justifyContent="space-between" marginTop={1}>
          <Text>
            Debate {currentDebate}/{totalDebates}
          </Text>
          <Text>
            Score: <Text color="blue">{totalS1Wins}</Text> - <Text color="magenta">{totalS2Wins}</Text>
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
              <Text bold color="yellow">
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
              <Text bold color="green">Completed:</Text>
              <Box flexWrap="wrap" marginTop={1}>
                {completedQuestions.map((qs, i) => (
                  <Box key={qs.questionIndex} marginRight={2}>
                    <Text>
                      Q{qs.questionIndex + 1}{" "}
                      <Text color={qs.verdict?.winnerId === firstSpeaker.id ? "blue" : "magenta"}>
                        {qs.verdict ? (qs.verdict.winnerId === firstSpeaker.id ? firstSpeaker.name : secondSpeaker.name) : "?"}
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
        <Box flexDirection="column" marginTop={1} borderStyle="single" borderColor="gray" paddingX={1}>
          <Text bold>Previous Debates:</Text>
          {debateResults.map((result, i) => (
            <Text key={i}>
              Debate {i + 1}: <Text color="blue">{firstSpeaker.name} {result.speaker1Wins}</Text> - <Text color="magenta">{result.speaker2Wins} {secondSpeaker.name}</Text>
            </Text>
          ))}
        </Box>
      )}

      {/* Match complete */}
      {phase === "complete" && (
        <Box flexDirection="column" marginTop={1} borderStyle="double" borderColor="green" paddingX={2}>
          <Text bold color="green">Match Complete!</Text>
          <Box marginTop={1}>
            <Text>
              Final: <Text color="blue">{firstSpeaker.name} {totalS1Wins}</Text> - <Text color="magenta">{totalS2Wins} {secondSpeaker.name}</Text>
            </Text>
          </Box>
          <Box marginTop={1}>
            <Text color="gray">Saved to matches/{match.id}/</Text>
          </Box>
        </Box>
      )}
    </Box>
  );
}
