import React, { useState, useEffect } from "react";
import { Box, Text, useApp } from "ink";
import {
  SpeakerInput,
  SettingsInput,
  TopicFocusInput,
  QuestionReview,
  OptionsToggle,
  ConfirmStart,
  MatchView,
  Spinner,
} from "./components/index.js";
import { runMatch, type MatchCallbacks } from "./services/match-engine.js";
import { generateDisplayNames } from "./services/name-generator.js";
import type { MatchConfig, MatchState, QuestionExecutionState, WizardState } from "./types/debate.js";
import { DEFAULT_WIZARD_STATE } from "./types/debate.js";
import { DEFAULT_MODEL_ID } from "./types/agent.js";

export interface AppProps {
  cliArgs?: {
    speaker1?: string;
    speaker2?: string;
    seed1?: string;
    seed2?: string;
    rounds?: number;
    questions?: number;
    issues?: string;
    humanCoach?: boolean;
    debates?: number;
    autopilot?: boolean;
    forkFrom?: string;
    selfImprove?: boolean;
    model?: string;
    narrate?: boolean;
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

    // Generate short display names from potentially long personas (in one call for consistency)
    const [name1, name2] = await generateDisplayNames(cliArgs.speaker1, cliArgs.speaker2, modelId);

    const matchConfig: MatchConfig = {
      speaker1Name: name1,
      speaker2Name: name2,
      speaker1Persona: cliArgs.speaker1,  // Keep full persona for prompt generation
      speaker2Persona: cliArgs.speaker2,
      totalDebates: cliArgs.debates || 1,
      questionsPerDebate: cliArgs.questions || 5,
      roundsPerQuestion: cliArgs.rounds || 3,
      humanCoachEnabled: cliArgs.humanCoach ?? false,
      selfImprove: cliArgs.selfImprove ?? true,
      issueFocus: issues.length > 0 ? issues : undefined,
      modelId,
      seed1: cliArgs.seed1,
      seed2: cliArgs.seed2,
      narrate: cliArgs.narrate ?? false,
    };

    try {
      await runMatch(matchConfig, callbacks, cliArgs.forkFrom);
    } catch (error) {
      console.error("Failed to run match:", error);
      exit();
    }
  };

  const handleSpeakers = async (speaker1: string, speaker2: string) => {
    // Generate short display names from potentially long personas (in one call for consistency)
    const [name1, name2] = await generateDisplayNames(speaker1, speaker2, modelId);

    setWizard((prev) => ({
      ...prev,
      speaker1Name: name1,
      speaker2Name: name2,
      speaker1Persona: speaker1,
      speaker2Persona: speaker2,
      step: "confirm",
    }));
  };

  const handleConfirmStart = () => {
    // Start with defaults
    setWizard((prev) => ({ ...prev, step: "ready" }));

    const matchConfig: MatchConfig = {
      speaker1Name: wizard.speaker1Name,
      speaker2Name: wizard.speaker2Name,
      speaker1Persona: wizard.speaker1Persona,
      speaker2Persona: wizard.speaker2Persona,
      totalDebates: wizard.debateCount,
      questionsPerDebate: wizard.questionCount,
      roundsPerQuestion: wizard.roundsPerQuestion,
      humanCoachEnabled: false,
      selfImprove: true,
      modelId,
      narrate: wizard.narrate,
    };

    runMatch(matchConfig, callbacks).catch((error) => {
      console.error("Failed to run match:", error);
    });
  };

  const handleEditSettings = () => {
    setWizard((prev) => ({ ...prev, step: "settings" }));
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
      step: "options",
    }));
  };

  const handleOptions = async (narrate: boolean) => {
    setWizard((prev) => ({
      ...prev,
      narrate,
      step: "ready",
    }));

    const matchConfig: MatchConfig = {
      speaker1Name: wizard.speaker1Name,
      speaker2Name: wizard.speaker2Name,
      speaker1Persona: wizard.speaker1Persona,
      speaker2Persona: wizard.speaker2Persona,
      totalDebates: wizard.debateCount || 1,
      questionsPerDebate: wizard.questionCount,
      roundsPerQuestion: wizard.roundsPerQuestion,
      humanCoachEnabled: false,
      selfImprove: true,
      issueFocus: wizard.issueFocus.length > 0 ? wizard.issueFocus : undefined,
      modelId,
      narrate,
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
          <Text bold color="white">Open Debate</Text>
          <Text dimColor> - AI Debate Arena</Text>
        </Box>

        {wizard.step === "speakers" && <SpeakerInput onComplete={handleSpeakers} />}
        {wizard.step === "confirm" && (
          <ConfirmStart
            speaker1Name={wizard.speaker1Name}
            speaker2Name={wizard.speaker2Name}
            rounds={wizard.roundsPerQuestion}
            questions={wizard.questionCount}
            debates={wizard.debateCount}
            narrate={wizard.narrate}
            onConfirm={handleConfirmStart}
            onEdit={handleEditSettings}
          />
        )}
        {wizard.step === "settings" && <SettingsInput onComplete={handleSettings} />}
        {wizard.step === "topic_focus" && <TopicFocusInput onComplete={handleTopicFocus} />}
        {wizard.step === "options" && <OptionsToggle onComplete={handleOptions} />}
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
