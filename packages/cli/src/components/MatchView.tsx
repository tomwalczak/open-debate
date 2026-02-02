import React, { useState, useEffect } from "react";
import { Box, Text, useInput } from "ink";
import type { MatchState, TopicExecutionState, MatchSummary, IssueArgumentSummary, ArgumentPoint, HumanInputContext, HumanContinueContext, CoachContext, CoachMessage } from "@open-debate/core";

// Recursive component to render hierarchical argument structure
function ArgumentTree({ point, depth = 0 }: { point: ArgumentPoint; depth?: number }) {
  return (
    <Box flexDirection="column" marginLeft={depth > 0 ? 2 : 0}>
      <Text wrap="wrap">{depth > 0 ? "- " : ""}{point.claim}</Text>
      {point.support?.map((sub, i) => (
        <ArgumentTree key={i} point={sub as ArgumentPoint} depth={depth + 1} />
      ))}
    </Box>
  );
}
import { Spinner } from "./Spinner.js";
import { ProgressBar } from "./ProgressBar.js";
import { TopicTabBar } from "./TopicTabBar.js";
import { ExpandedTopicView } from "./ExpandedTopicView.js";
import { HumanDebateInput } from "./HumanDebateInput.js";
import { theme } from "../theme.js";

interface MatchViewProps {
  match: MatchState | null;
  currentDebate: number;
  topicStates: Map<number, TopicExecutionState>;
  phase: "init" | "generating" | "debating" | "judging" | "learning" | "complete";
  debateResults: Array<{ speaker1Wins: number; speaker2Wins: number }>;
  matchSummary?: MatchSummary | null;
  issueArguments?: IssueArgumentSummary[];
  humanInputContext?: HumanInputContext | null;
  onHumanResponse?: (response: string) => void;
  humanContinueContext?: HumanContinueContext | null;
  onHumanContinue?: () => void;
  onHintRequest?: (context: CoachContext, conversationHistory: CoachMessage[], userRequest?: string) => Promise<string>;
}

export function MatchView({
  match,
  currentDebate,
  topicStates,
  phase,
  debateResults,
  matchSummary,
  issueArguments = [],
  humanInputContext,
  onHumanResponse,
  humanContinueContext,
  onHumanContinue,
  onHintRequest,
}: MatchViewProps) {
  // Selected topic index for tabbed view
  const [selectedTopicIndex, setSelectedTopicIndex] = useState(0);

  // Convert map to sorted array
  const sortedTopicStates = Array.from(topicStates.values()).sort(
    (a, b) => a.topicIndex - b.topicIndex
  );

  const isTTY = process.stdin.isTTY;

  // Handle Enter key for continue prompt
  useInput((input, key) => {
    if (humanContinueContext && onHumanContinue && key.return) {
      onHumanContinue();
    }
  }, { isActive: isTTY && !!humanContinueContext });

  // Auto-select first active topic when selection becomes invalid or pending
  useEffect(() => {
    if (sortedTopicStates.length === 0) return;

    const currentSelected = sortedTopicStates[selectedTopicIndex];

    // If current selection is valid and not pending, keep it
    if (currentSelected && currentSelected.status !== "pending") return;

    // Find first active (debating/judging) topic
    const firstActiveIndex = sortedTopicStates.findIndex(
      (ts) => ts.status === "debating" || ts.status === "judging"
    );

    if (firstActiveIndex !== -1 && firstActiveIndex !== selectedTopicIndex) {
      setSelectedTopicIndex(firstActiveIndex);
    }
  }, [sortedTopicStates, selectedTopicIndex]);

  if (!match) {
    return (
      <Box padding={1}>
        <Spinner label="Initializing match..." />
      </Box>
    );
  }

  const { config, firstSpeaker, secondSpeaker } = match;
  const totalDebates = config.totalDebates;
  const totalTopics = config.topicsPerDebate;

  // Calculate progress for current debate
  const totalExchanges = config.topicsPerDebate * config.turnsPerTopic * 2;
  const completedExchanges = sortedTopicStates.reduce(
    (sum, ts) => sum + ts.exchanges.length,
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
          <Spinner label="Generating topics..." />
        </Box>
      )}

      {phase === "learning" && (
        <Box marginBottom={1}>
          <Spinner label="Agents reflecting on debate..." />
        </Box>
      )}

      {/* Human Input UI */}
      {humanInputContext && onHumanResponse && onHintRequest && (
        <HumanDebateInput
          turnNumber={humanInputContext.turnNumber}
          totalTurns={humanInputContext.totalTurns}
          topic={humanInputContext.topic}
          speakerName={humanInputContext.speakerName}
          speakerId={humanInputContext.currentSpeakerId}
          speakerPersona={humanInputContext.speakerPersona}
          exchanges={humanInputContext.exchanges}
          onSubmit={onHumanResponse}
          onHintRequest={(conversationHistory, userRequest) => onHintRequest({
            topic: humanInputContext.topic,
            speakerName: humanInputContext.speakerName,
            speakerPersona: humanInputContext.speakerPersona,
            exchanges: humanInputContext.exchanges,
            turnNumber: humanInputContext.turnNumber,
            totalTurns: humanInputContext.totalTurns,
          }, conversationHistory, userRequest)}
        />
      )}

      {/* Human Continue Prompt - show opponent's response */}
      {humanContinueContext && onHumanContinue && (
        <Box flexDirection="column" gap={1} paddingX={1}>
          <Box borderStyle="single" borderColor="yellow" paddingX={1}>
            <Text bold color="yellow">
              {humanContinueContext.opponentName} responded - Turn {humanContinueContext.turnNumber}/{humanContinueContext.totalTurns}
            </Text>
          </Box>

          <Text wrap="wrap" dimColor>
            <Text bold>Topic:</Text> {humanContinueContext.topic}
          </Text>

          <Box flexDirection="column" marginTop={1}>
            <Text bold color={theme.speaker2}>{humanContinueContext.opponentName}:</Text>
            <Box marginLeft={2} marginTop={1}>
              <Text wrap="wrap">{humanContinueContext.opponentMessage}</Text>
            </Box>
          </Box>

          <Box marginTop={1} borderStyle="round" borderColor="green" paddingX={1}>
            <Text color="green">
              {humanContinueContext.isLastTurn
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

          {/* Topic Tab Bar and Expanded View */}
          {sortedTopicStates.length > 0 && (
            <Box flexDirection="column" marginTop={1}>
              <TopicTabBar
                topicStates={sortedTopicStates}
                activeIndex={selectedTopicIndex}
                onSwitch={setSelectedTopicIndex}
                totalTurns={config.turnsPerTopic}
              />
              {sortedTopicStates[selectedTopicIndex] && (
                <ExpandedTopicView
                  state={sortedTopicStates[selectedTopicIndex]}
                  speaker1Id={firstSpeaker.id}
                  speaker2Id={secondSpeaker.id}
                  speaker1Name={firstSpeaker.name}
                  speaker2Name={secondSpeaker.name}
                  totalTurns={config.turnsPerTopic}
                  totalTopics={totalTopics}
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
              <Text bold color={theme.accent}>Issues:</Text>
              <Box flexDirection="column" marginLeft={1}>
                {matchSummary.issues.map((issue, i) => (
                  <Text key={i}>• {issue}</Text>
                ))}
              </Box>
              <Box marginTop={1}>
                <Text bold color={theme.accent}>Summary:</Text>
              </Box>
              <Box marginTop={1}>
                <Text wrap="wrap">{matchSummary.summary}</Text>
              </Box>

              {/* Issue Argument Breakdowns */}
              {issueArguments.length > 0 && (
                <Box flexDirection="column" marginTop={2}>
                  <Text bold color={theme.accent}>Argument Breakdown:</Text>
                  {issueArguments.map((issueArg, i) => (
                    <Box key={i} flexDirection="column" marginTop={1} marginLeft={1}>
                      <Text bold>• {issueArg.issue}</Text>
                      <Box flexDirection="column" marginLeft={2} marginTop={1}>
                        <Text color={theme.speaker1} bold>{firstSpeaker.name}:</Text>
                        <ArgumentTree point={issueArg.speaker1Argument} />
                      </Box>
                      <Box flexDirection="column" marginLeft={2} marginTop={1}>
                        <Text color={theme.speaker2} bold>{secondSpeaker.name}:</Text>
                        <ArgumentTree point={issueArg.speaker2Argument} />
                      </Box>
                    </Box>
                  ))}
                </Box>
              )}

              {/* Show spinner while generating remaining issue arguments */}
              {matchSummary.issues.length > issueArguments.length && (
                <Box marginTop={1}>
                  <Spinner label={`Analyzing arguments (${issueArguments.length}/${matchSummary.issues.length})...`} />
                </Box>
              )}
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
