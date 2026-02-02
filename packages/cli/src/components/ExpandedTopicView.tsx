import React, { useRef, useEffect } from "react";
import { Box, Text, useInput, useStdout } from "ink";
import { ScrollView, type ScrollViewRef } from "ink-scroll-view";
import type { TopicExecutionState } from "@open-debate/core";
import { ExchangeMessage } from "./ExchangeMessage.js";
import { JudgeVerdict } from "./JudgeVerdict.js";
import { Spinner } from "./Spinner.js";
import { theme } from "../theme.js";

const isTTY = process.stdin.isTTY;

interface ExpandedTopicViewProps {
  state: TopicExecutionState;
  speaker1Id: string;
  speaker2Id: string;
  speaker1Name: string;
  speaker2Name: string;
  totalTurns: number;
  totalTopics: number;
}

export function ExpandedTopicView({
  state,
  speaker1Id,
  speaker2Id,
  speaker1Name,
  speaker2Name,
  totalTurns,
  totalTopics,
}: ExpandedTopicViewProps) {
  const {
    topicIndex,
    topic,
    status,
    currentTurn,
    currentSpeakerId,
    exchanges,
    streamingText,
    verdict,
  } = state;

  const scrollRef = useRef<ScrollViewRef>(null);
  const { stdout } = useStdout();

  // Handle terminal resize
  useEffect(() => {
    const handleResize = () => scrollRef.current?.remeasure();
    stdout?.on("resize", handleResize);
    return () => {
      stdout?.off("resize", handleResize);
    };
  }, [stdout]);

  // Scroll controls (up/down arrows) - only in TTY mode
  if (isTTY) {
    useInput((input, key) => {
      if (key.upArrow) scrollRef.current?.scrollBy(-3);
      if (key.downArrow) scrollRef.current?.scrollBy(3);
    });
  }

  // Auto-scroll to bottom when new exchanges are added (not on every streaming char)
  useEffect(() => {
    scrollRef.current?.scrollToBottom();
  }, [exchanges.length]);

  const currentSpeakerName =
    currentSpeakerId === speaker1Id ? speaker1Name : speaker2Name;
  const speakerColor =
    currentSpeakerId === speaker1Id ? theme.speaker1 : theme.speaker2;

  const getTurnIndicator = () => {
    switch (status) {
      case "pending":
        return <Text dimColor>Pending</Text>;
      case "debating":
        return (
          <Text color={theme.accent}>
            Turn {currentTurn}/{totalTurns}
          </Text>
        );
      case "judging":
        return <Text color="yellow">Judging</Text>;
      case "complete":
        return <Text color={theme.success}>Complete</Text>;
    }
  };

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={
        status === "complete"
          ? theme.borderComplete
          : status === "debating" || status === "judging"
          ? theme.borderActive
          : theme.borderDefault
      }
      paddingX={1}
      marginBottom={1}
      height={32}
    >
      {/* Header: Topic number + turn indicator */}
      <Box justifyContent="space-between" marginBottom={1}>
        <Text bold>
          Topic {topicIndex + 1} of {totalTopics}
        </Text>
        <Box gap={2}>
          <Text dimColor>↑↓ scroll</Text>
          {getTurnIndicator()}
        </Box>
      </Box>

      {/* Scrollable content area */}
      <ScrollView ref={scrollRef} flexGrow={1}>
        {/* Full topic text */}
        <Box marginBottom={1}>
          <Text wrap="wrap" color={theme.accent}>
            "{topic}"
          </Text>
        </Box>

        {/* Transcript: all exchanges */}
        {exchanges.length > 0 && (
          <Box flexDirection="column" marginBottom={1}>
            {exchanges.map((exchange) => (
              <ExchangeMessage
                key={exchange.id}
                exchange={exchange}
                speaker1Id={speaker1Id}
              />
            ))}
          </Box>
        )}

        {/* Live streaming text (full, not truncated) */}
        {status === "debating" && currentSpeakerId && (
          <Box flexDirection="column" marginBottom={1}>
            <Box>
              <Text color={speakerColor} bold>
                {currentSpeakerName}:{" "}
              </Text>
              {streamingText ? (
                <Spinner />
              ) : (
                <Text dimColor>thinking...</Text>
              )}
            </Box>
            {streamingText && (
              <Box marginLeft={2}>
                <Text wrap="wrap">{streamingText}</Text>
              </Box>
            )}
          </Box>
        )}

        {/* Judging indicator */}
        {status === "judging" && (
          <Box marginBottom={1}>
            <Spinner label="Judge evaluating arguments..." />
          </Box>
        )}

        {/* Pending indicator */}
        {status === "pending" && (
          <Box marginBottom={1}>
            <Text dimColor>Waiting to start...</Text>
          </Box>
        )}

        {/* Verdict when complete */}
        {status === "complete" && verdict && (
          <JudgeVerdict
            verdict={verdict}
            topicNumber={topicIndex + 1}
            speaker1Id={speaker1Id}
            speaker2Id={speaker2Id}
            speaker1Name={speaker1Name}
            speaker2Name={speaker2Name}
          />
        )}
      </ScrollView>
    </Box>
  );
}
