import React, { useState, useEffect } from "react";
import { Box, Text, useInput } from "ink";
import type { MatchState, QuestionExecutionState, MatchSummary, HumanInputContext, HumanContinueContext } from "@open-debate/core";
import { Spinner } from "./Spinner.js";
import { ProgressBar } from "./ProgressBar.js";
import { QuestionTabBar } from "./QuestionTabBar.js";
import { ExpandedQuestionView } from "./ExpandedQuestionView.js";
import { HumanDebateInput } from "./HumanDebateInput.js";
import { theme } from "../theme.js";

interface MatchViewProps {
  match: MatchState | null;
  currentDebate: number;
  questionStates: Map<number, QuestionExecutionState>;
  phase: "init" | "generating" | "debating" | "judging" | "learning" | "complete";
  debateResults: Array<{ speaker1Wins: number; speaker2Wins: number }>;
  matchSummary?: MatchSummary | null;
  humanInputContext?: HumanInputContext | null;
  onHumanResponse?: (response: string) => void;
  humanContinueContext?: HumanContinueContext | null;
  onHumanContinue?: () => void;
}

export function MatchView({
  match,
  currentDebate,
  questionStates,
  phase,
  debateResults,
  matchSummary,
  humanInputContext,
  onHumanResponse,
  humanContinueContext,
  onHumanContinue,
}: MatchViewProps) {
  // Selected question index for tabbed view
  const [selectedQuestionIndex, setSelectedQuestionIndex] = useState(0);

  // Convert map to sorted array
  const sortedQuestionStates = Array.from(questionStates.values()).sort(
    (a, b) => a.questionIndex - b.questionIndex
  );

  // Handle Enter key for continue prompt
  useInput((input, key) => {
    if (humanContinueContext && onHumanContinue && key.return) {
      onHumanContinue();
    }
  });

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

  if (!match) {
    return (
      <Box padding={1}>
        <Spinner label="Initializing match..." />
      </Box>
    );
  }

  const { config, firstSpeaker, secondSpeaker } = match;
  const totalDebates = config.totalDebates;
  const totalQuestions = config.questionsPerDebate;

  // Calculate progress for current debate
  const totalExchanges = config.questionsPerDebate * config.roundsPerQuestion * 2;
  const completedExchanges = sortedQuestionStates.reduce(
    (sum, qs) => sum + qs.exchanges.length,
    0
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

      {/* Human Input UI */}
      {humanInputContext && onHumanResponse && (
        <HumanDebateInput
          roundNumber={humanInputContext.roundNumber}
          totalRounds={humanInputContext.totalRounds}
          question={humanInputContext.question}
          speakerName={humanInputContext.speakerName}
          speakerId={humanInputContext.currentSpeakerId}
          exchanges={humanInputContext.exchanges}
          onSubmit={onHumanResponse}
        />
      )}

      {/* Human Continue Prompt - show opponent's response */}
      {humanContinueContext && onHumanContinue && (
        <Box flexDirection="column" gap={1} paddingX={1}>
          <Box borderStyle="single" borderColor="yellow" paddingX={1}>
            <Text bold color="yellow">
              {humanContinueContext.opponentName} responded - Round {humanContinueContext.roundNumber}/{humanContinueContext.totalRounds}
            </Text>
          </Box>

          <Text wrap="wrap" dimColor>
            <Text bold>Question:</Text> {humanContinueContext.question}
          </Text>

          <Box flexDirection="column" marginTop={1}>
            <Text bold color={theme.speaker2}>{humanContinueContext.opponentName}:</Text>
            <Box marginLeft={2} marginTop={1}>
              <Text wrap="wrap">{humanContinueContext.opponentMessage}</Text>
            </Box>
          </Box>

          <Box marginTop={1} borderStyle="round" borderColor="green" paddingX={1}>
            <Text color="green">
              {humanContinueContext.isLastRound
                ? "Press Enter to proceed to judging..."
                : "Press Enter to continue to your turn..."}
            </Text>
          </Box>
        </Box>
      )}

      {/* Debate progress */}
      {(phase === "debating" || phase === "judging") && !humanInputContext && !humanContinueContext && (
        <>
          <ProgressBar
            current={completedExchanges}
            total={totalExchanges}
            label={`Debate ${currentDebate}:`}
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
                  speaker2Id={secondSpeaker.id}
                  speaker1Name={firstSpeaker.name}
                  speaker2Name={secondSpeaker.name}
                  totalRounds={config.roundsPerQuestion}
                  totalQuestions={totalQuestions}
                />
              )}
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
          <Box marginTop={1} flexDirection="column">
            {totalS1Wins > totalS2Wins ? (
              <>
                <Text bold color={theme.speaker1}>{firstSpeaker.name} wins!</Text>
                <Text dimColor>Final: {totalS1Wins} - {totalS2Wins}</Text>
              </>
            ) : totalS2Wins > totalS1Wins ? (
              <>
                <Text bold color={theme.speaker2}>{secondSpeaker.name} wins!</Text>
                <Text dimColor>Final: {totalS2Wins} - {totalS1Wins}</Text>
              </>
            ) : (
              <>
                <Text bold>Match Tied!</Text>
                <Text dimColor>Final: {totalS1Wins} - {totalS2Wins}</Text>
              </>
            )}
          </Box>

          {/* Judge's Summary */}
          {matchSummary ? (
            <Box flexDirection="column" marginTop={1}>
              <Text bold color={theme.accent}>Judge's Analysis:</Text>
              <Box marginTop={1}>
                <Text wrap="wrap">{matchSummary.summary}</Text>
              </Box>
            </Box>
          ) : (
            <Box marginTop={1}>
              <Spinner label="Generating judge's analysis..." />
            </Box>
          )}

          <Box marginTop={1}>
            <Text dimColor>Saved to matches/{match.id}/</Text>
          </Box>
        </Box>
      )}
    </Box>
  );
}
