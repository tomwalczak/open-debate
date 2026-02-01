import React, { useState, useEffect } from "react";
import { Box, Text } from "ink";
import type { DebateState, TopicExecutionState } from "@open-debate/core";
import { Spinner } from "./Spinner.js";
import { ProgressBar } from "./ProgressBar.js";
import { FinalTally } from "./FinalTally.js";
import { HumanFeedback } from "./HumanFeedback.js";
import { TopicTabBar } from "./TopicTabBar.js";
import { ExpandedTopicView } from "./ExpandedTopicView.js";

interface ParallelDebateViewProps {
  state: DebateState;
  topicStates: Map<number, TopicExecutionState>;
  onHumanFeedback: (feedback: string) => void;
}

export function ParallelDebateView({
  state,
  topicStates,
  onHumanFeedback,
}: ParallelDebateViewProps) {
  const {
    firstSpeaker,
    secondSpeaker,
    config,
    currentPhase,
    finalTally,
  } = state;

  // Selected topic index for tabbed view
  const [selectedTopicIndex, setSelectedTopicIndex] = useState(0);

  // Convert map to sorted array
  const sortedTopicStates = Array.from(topicStates.values()).sort(
    (a, b) => a.topicIndex - b.topicIndex
  );

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

  // Calculate overall progress
  const totalExchanges = config.topics.length * config.turnsPerTopic * 2;
  const completedExchanges = sortedTopicStates.reduce(
    (sum, ts) => sum + ts.exchanges.length,
    0
  );

  // Count completed topics for header
  const completedCount = sortedTopicStates.filter(
    (ts) => ts.status === "complete"
  ).length;
  const totalTopics = config.topics.length;

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
          {completedCount}/{totalTopics} done
        </Text>
      </Box>

      {/* Progress */}
      <ProgressBar
        current={completedExchanges}
        total={totalExchanges}
        label="Progress:"
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
