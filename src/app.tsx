import React, { useState, useEffect } from "react";
import { Box, Text, useApp } from "ink";
import {
  SpeakerInput,
  SettingsInput,
  TopicFocusInput,
  QuestionReview,
  CoachToggle,
  MatchView,
  Spinner,
} from "./components/index.js";
import { runMatch, type MatchCallbacks } from "./services/match-engine.js";
import { findLatestMatch } from "./services/match-storage.js";
import type { MatchConfig, MatchState, QuestionExecutionState, WizardState } from "./types/debate.js";
import { DEFAULT_WIZARD_STATE } from "./types/debate.js";
import { DEFAULT_MODEL_ID } from "./types/agent.js";

export interface AppProps {
  cliArgs?: {
    speaker1?: string;
    speaker2?: string;
    rounds?: number;
    questions?: number;
    issues?: string;
    humanCoach?: boolean;
    debates?: number;
    autopilot?: boolean;
    fork?: boolean;
    selfImprove?: boolean;
    model?: string;
  };
}

type MatchPhase = "init" | "generating" | "debating" | "judging" | "learning" | "complete";

export function App({ cliArgs }: AppProps) {
  const { exit } = useApp();
  const [wizard, setWizard] = useState<WizardState>(DEFAULT_WIZARD_STATE);
  const [match, setMatch] = useState<MatchState | null>(null);
  const [currentDebate, setCurrentDebate] = useState(1);
  const [phase, setPhase] = useState<MatchPhase>("init");
  const [questionStates, setQuestionStates] = useState<Map<number, QuestionExecutionState>>(new Map());
  const [debateResults, setDebateResults] = useState<Array<{ speaker1Wins: number; speaker2Wins: number }>>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [modelId] = useState(cliArgs?.model || DEFAULT_MODEL_ID);

  const callbacks: MatchCallbacks = {
    onMatchStart: (m: MatchState) => {
      setMatch(m);
      setPhase("init");
    },
    onDebateStart: (debateNumber: number) => {
      setCurrentDebate(debateNumber);
      setQuestionStates(new Map());
      setPhase("generating");
    },
    onDebateEnd: (debateNumber: number, speaker1Wins: number, speaker2Wins: number) => {
      setDebateResults((prev) => [...prev, { speaker1Wins, speaker2Wins }]);
    },
    onMatchEnd: (_m: MatchState) => {
      setPhase("complete");
    },
    onQuestionStateChange: (questionState: QuestionExecutionState) => {
      setQuestionStates((prev) => {
        const newMap = new Map(prev);
        newMap.set(questionState.questionIndex, questionState);
        return newMap;
      });
      // Update phase based on question states
      if (questionState.status === "debating") {
        setPhase("debating");
      } else if (questionState.status === "judging") {
        setPhase("judging");
      }
    },
    onQuestionStreamChunk: (_questionIndex: number, _chunk: string) => {
      // Streaming is handled via onQuestionStateChange
    },
    onLearning: () => {
      setPhase("learning");
    },
    onError: (error: Error) => {
      console.error("Match error:", error);
    },
  };

  // Handle CLI args for automation mode
  useEffect(() => {
    if (cliArgs?.speaker1 && cliArgs?.speaker2) {
      handleCliAutomation();
    }
  }, []);

  const handleCliAutomation = async () => {
    if (!cliArgs?.speaker1 || !cliArgs?.speaker2) return;

    const issues = cliArgs.issues?.split(",").map((s) => s.trim()) || [];

    // Check if forking from existing match
    let forkFromMatchId: string | undefined;
    if (cliArgs.fork) {
      forkFromMatchId = findLatestMatch(cliArgs.speaker1, cliArgs.speaker2) || undefined;
    }

    const matchConfig: MatchConfig = {
      speaker1Name: cliArgs.speaker1,
      speaker2Name: cliArgs.speaker2,
      totalDebates: cliArgs.debates || 1,
      questionsPerDebate: cliArgs.questions || 5,
      roundsPerQuestion: cliArgs.rounds || 3,
      humanCoachEnabled: cliArgs.humanCoach ?? false,
      selfImprove: cliArgs.selfImprove ?? false,
      issueFocus: issues.length > 0 ? issues : undefined,
      modelId,
    };

    try {
      await runMatch(matchConfig, callbacks, forkFromMatchId);
    } catch (error) {
      console.error("Failed to run match:", error);
      exit();
    }
  };

  const handleSpeakers = (speaker1: string, speaker2: string) => {
    setWizard((prev) => ({
      ...prev,
      speaker1Name: speaker1,
      speaker2Name: speaker2,
      step: "settings",
    }));
  };

  const handleSettings = (rounds: number, questionCount: number, debateCount: number) => {
    setWizard((prev) => ({
      ...prev,
      roundsPerQuestion: rounds,
      questionCount,
      debateCount,
      step: "topic_focus",
    }));
  };

  const handleTopicFocus = async (topics: string[]) => {
    setWizard((prev) => ({
      ...prev,
      issueFocus: topics,
      step: "coach_toggle",
    }));
  };

  const handleCoachToggle = async (enabled: boolean) => {
    setWizard((prev) => ({
      ...prev,
      humanCoachEnabled: enabled,
      step: "ready",
    }));

    const matchConfig: MatchConfig = {
      speaker1Name: wizard.speaker1Name,
      speaker2Name: wizard.speaker2Name,
      totalDebates: wizard.debateCount || 1,
      questionsPerDebate: wizard.questionCount,
      roundsPerQuestion: wizard.roundsPerQuestion,
      humanCoachEnabled: enabled,
      selfImprove: false,
      issueFocus: wizard.issueFocus.length > 0 ? wizard.issueFocus : undefined,
      modelId,
    };

    try {
      await runMatch(matchConfig, callbacks);
    } catch (error) {
      console.error("Failed to run match:", error);
    }
  };

  // Wizard mode (no CLI args)
  if (!cliArgs?.speaker1 && wizard.step !== "ready") {
    return (
      <Box flexDirection="column" padding={1}>
        <Box marginBottom={1}>
          <Text bold color="cyan">Open Debate</Text>
          <Text color="gray"> - AI Debate Arena</Text>
        </Box>

        {wizard.step === "speakers" && <SpeakerInput onComplete={handleSpeakers} />}
        {wizard.step === "settings" && <SettingsInput onComplete={handleSettings} />}
        {wizard.step === "topic_focus" && <TopicFocusInput onComplete={handleTopicFocus} />}
        {wizard.step === "coach_toggle" && <CoachToggle onComplete={handleCoachToggle} />}
      </Box>
    );
  }

  // Match view
  return (
    <MatchView
      match={match}
      currentDebate={currentDebate}
      questionStates={questionStates}
      phase={phase}
      debateResults={debateResults}
    />
  );
}
