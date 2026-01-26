import React from "react";
import { Box, Text } from "ink";
import type { DebateState } from "../types/debate.js";
import { Spinner } from "./Spinner.js";
import { ProgressBar } from "./ProgressBar.js";
import { QuestionProgress } from "./QuestionProgress.js";
import { ExchangeMessage } from "./ExchangeMessage.js";
import { JudgeVerdict } from "./JudgeVerdict.js";
import { FinalTally } from "./FinalTally.js";
import { HumanFeedback } from "./HumanFeedback.js";

interface DebateViewProps {
  state: DebateState;
  streamingText: string;
  onHumanFeedback: (feedback: string) => void;
}

export function DebateView({ state, streamingText, onHumanFeedback }: DebateViewProps) {
  const {
    firstSpeaker,
    secondSpeaker,
    config,
    currentQuestionIndex,
    currentRound,
    currentPhase,
    currentSpeakerId,
    questionResults,
    finalTally,
  } = state;

  const currentQuestion = config.questions[currentQuestionIndex];
  const totalExchanges = config.questions.length * config.roundsPerQuestion * 2;
  const completedExchanges = questionResults.reduce(
    (sum, qr) => sum + qr.exchanges.length,
    0
  );

  const currentSpeaker =
    currentSpeakerId === firstSpeaker.id ? firstSpeaker : secondSpeaker;

  // Get current question's exchanges
  const currentExchanges =
    questionResults[currentQuestionIndex]?.exchanges || [];

  return (
    <Box flexDirection="column" padding={1}>
      {/* Header */}
      <Box borderStyle="round" borderColor="cyan" paddingX={2} marginBottom={1}>
        <Text bold>
          <Text color="blue">{firstSpeaker.name}</Text>
          <Text> vs </Text>
          <Text color="magenta">{secondSpeaker.name}</Text>
        </Text>
      </Box>

      {/* Progress */}
      <ProgressBar
        current={completedExchanges}
        total={totalExchanges}
        label="Progress:"
      />

      {/* Current question info */}
      {currentPhase === "debating" && currentQuestion && (
        <Box marginTop={1}>
          <QuestionProgress
            currentQuestion={currentQuestionIndex}
            totalQuestions={config.questions.length}
            currentRound={currentRound}
            totalRounds={config.roundsPerQuestion}
            question={currentQuestion}
          />
        </Box>
      )}

      {/* Previous exchanges for current question */}
      {currentExchanges.length > 0 && (
        <Box flexDirection="column" marginTop={1}>
          {currentExchanges.map((ex) => (
            <ExchangeMessage
              key={ex.id}
              exchange={ex}
              speaker1Id={firstSpeaker.id}
            />
          ))}
        </Box>
      )}

      {/* Streaming response */}
      {currentPhase === "debating" && currentSpeakerId && streamingText && (
        <Box flexDirection="column" marginTop={1}>
          <Text bold color={currentSpeakerId === firstSpeaker.id ? "blue" : "magenta"}>
            {currentSpeaker.name} (Round {currentRound})
          </Text>
          <Box marginLeft={2}>
            <Text wrap="wrap">{streamingText}</Text>
            <Spinner />
          </Box>
        </Box>
      )}

      {/* Activity indicator */}
      {currentPhase === "debating" && currentSpeakerId && !streamingText && (
        <Spinner label={`${currentSpeaker.name} is thinking...`} />
      )}

      {currentPhase === "judging" && (
        <Spinner label="Judge is evaluating..." />
      )}

      {currentPhase === "learning" && (
        <Spinner label="Agents are learning from debate..." />
      )}

      {/* Question verdicts */}
      {questionResults
        .filter((qr) => qr.verdict)
        .map((qr, i) => (
          <JudgeVerdict key={i} verdict={qr.verdict!} questionNumber={i + 1} />
        ))}

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
