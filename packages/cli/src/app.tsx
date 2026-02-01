import React, { useState, useEffect } from "react";
import { Box, Text, useApp } from "ink";
import {
  SpeakerInput,
  SettingsInput,
  TopicFocusInput,
  TopicReview,
  OptionsToggle,
  ConfirmStart,
  MatchView,
  Spinner,
} from "./components/index.js";
import {
  runMatch,
  resumeMatch,
  generateDisplayNames,
  parseMatchPrompt,
  getDebateCoaching,
  DEFAULT_MODEL_ID,
  DEFAULT_WIZARD_STATE,
  type MatchCallbacks,
  type ParsedMatchConfig,
  type MatchConfig,
  type MatchState,
  type TopicExecutionState,
  type WizardState,
  type Exchange,
  type HumanInputContext,
  type HumanContinueContext,
  type CoachContext,
  type CoachMessage,
  type MatchSummary,
} from "@open-debate/core";

export interface AppProps {
  cliArgs?: {
    prompt?: string;
    speaker1?: string;
    speaker2?: string;
    seed1?: string;
    seed2?: string;
    directPrompt1?: string;
    directPrompt2?: string;
    turns?: number;
    topics?: number;
    issues?: string;
    humanCoach?: boolean;
    debates?: number;
    autopilot?: boolean;
    forkFrom?: string;
    resume?: string;
    selfImprove?: boolean;
    model?: string;
    narrate?: boolean;
    judgeSeed?: string;
    humanSide?: "speaker1" | "speaker2";
  };
}

type MatchPhase = "init" | "generating" | "debating" | "judging" | "learning" | "complete";

export function App({ cliArgs }: AppProps) {
  const { exit } = useApp();
  const [wizard, setWizard] = useState<WizardState>(DEFAULT_WIZARD_STATE);
  const [match, setMatch] = useState<MatchState | null>(null);
  const [currentDebate, setCurrentDebate] = useState(1);
  const [phase, setPhase] = useState<MatchPhase>("init");
  const [topicStates, setTopicStates] = useState<Map<number, TopicExecutionState>>(new Map());
  const [debateResults, setDebateResults] = useState<Array<{ speaker1Wins: number; speaker2Wins: number }>>([]);
  const [matchSummary, setMatchSummary] = useState<MatchSummary | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [modelId] = useState(cliArgs?.model || DEFAULT_MODEL_ID);
  const [humanInputResolver, setHumanInputResolver] = useState<((value: string) => void) | null>(null);
  const [humanInputContext, setHumanInputContext] = useState<HumanInputContext | null>(null);
  const [humanContinueResolver, setHumanContinueResolver] = useState<(() => void) | null>(null);
  const [humanContinueContext, setHumanContinueContext] = useState<HumanContinueContext | null>(null);

  const callbacks: MatchCallbacks = {
    onMatchStart: (m: MatchState) => {
      setMatch(m);
      setPhase("init");
    },
    onDebateStart: (debateNumber: number) => {
      setCurrentDebate(debateNumber);
      setTopicStates(new Map());
      setPhase("generating");
    },
    onDebateEnd: (debateNumber: number, speaker1Wins: number, speaker2Wins: number) => {
      setDebateResults((prev) => [...prev, { speaker1Wins, speaker2Wins }]);
    },
    onMatchEnd: (_m: MatchState) => {
      setPhase("complete");
    },
    onMatchSummary: (summary: MatchSummary) => {
      setMatchSummary(summary);
    },
    onTopicStateChange: (topicState: TopicExecutionState) => {
      setTopicStates((prev) => {
        const newMap = new Map(prev);
        newMap.set(topicState.topicIndex, topicState);
        return newMap;
      });
      // Update phase based on topic states
      if (topicState.status === "debating") {
        setPhase("debating");
      } else if (topicState.status === "judging") {
        setPhase("judging");
      }
    },
    onTopicStreamChunk: (_topicIndex: number, _chunk: string) => {
      // Streaming is handled via onTopicStateChange
    },
    onLearning: () => {
      setPhase("learning");
    },
    onError: (error: Error) => {
      // Format error cleanly - don't dump raw JSON
      const msg = error.message || String(error);
      if (msg.includes("429") || msg.includes("RESOURCE_EXHAUSTED") || msg.includes("rate")) {
        console.error("\n⚠️  Rate limit hit - waiting and retrying...\n");
      } else if (msg.includes("502") || msg.includes("503")) {
        console.error("\n⚠️  API temporarily unavailable - retrying...\n");
      } else {
        console.error("\n⚠️  Error:", msg.slice(0, 200), "\n");
      }
    },
    onHumanInputRequired: async (context) => {
      return new Promise((resolve) => {
        setHumanInputContext(context);
        setHumanInputResolver(() => resolve);
      });
    },
    onWaitForHumanContinue: async (context) => {
      return new Promise((resolve) => {
        setHumanContinueContext(context);
        setHumanContinueResolver(() => resolve);
      });
    },
  };

  const handleHumanResponse = (response: string) => {
    if (humanInputResolver) {
      humanInputResolver(response);
      setHumanInputResolver(null);
      setHumanInputContext(null);
    }
  };

  const handleHumanContinue = () => {
    if (humanContinueResolver) {
      humanContinueResolver();
      setHumanContinueResolver(null);
      setHumanContinueContext(null);
    }
  };

  const handleHintRequest = async (context: CoachContext, conversationHistory: CoachMessage[], userRequest?: string): Promise<string> => {
    return getDebateCoaching({
      context,
      conversationHistory,
      userRequest,
      modelId,
    });
  };

  // Handle CLI args for automation mode
  useEffect(() => {
    if (cliArgs?.resume) {
      handleResumeMatch();
    } else if (cliArgs?.prompt) {
      handlePromptAutomation();
    } else if (cliArgs?.speaker1 && cliArgs?.speaker2) {
      handleCliAutomation();
    }
  }, []);

  const handleResumeMatch = async () => {
    if (!cliArgs?.resume) return;

    setIsLoading(true);
    try {
      const result = await resumeMatch(cliArgs.resume, callbacks);
      if (!result) {
        console.error("Failed to resume match - match not found or invalid:", cliArgs.resume);
        exit();
        return;
      }
    } catch (error) {
      console.error("Failed to resume match:", error);
      exit();
    }
    setIsLoading(false);
  };

  const handlePromptAutomation = async () => {
    if (!cliArgs?.prompt) return;

    setIsLoading(true);
    try {
      const parsed = await parseMatchPrompt(cliArgs.prompt, modelId);

      if (!parsed.speaker1 || !parsed.speaker2) {
        console.error("Could not extract two speakers from prompt:", cliArgs.prompt);
        exit();
        return;
      }

      // Generate short display names
      const [name1, name2] = await generateDisplayNames(parsed.speaker1, parsed.speaker2, modelId);

      const matchConfig: MatchConfig = {
        speaker1Name: name1,
        speaker2Name: name2,
        speaker1Persona: parsed.speaker1,
        speaker2Persona: parsed.speaker2,
        totalDebates: parsed.totalDebates,
        topicsPerDebate: parsed.topicsPerDebate,
        turnsPerTopic: parsed.turnsPerTopic,
        humanCoachEnabled: cliArgs.humanCoach ?? false,
        selfImprove: cliArgs.selfImprove ?? true,
        issueFocus: parsed.issueFocus,
        modelId,
        narrate: parsed.narrate,
        judgeSeed: cliArgs.judgeSeed,
        humanSide: cliArgs.humanSide,
      };

      setIsLoading(false);
      await runMatch(matchConfig, callbacks, cliArgs.forkFrom);
    } catch (error) {
      console.error("Failed to parse prompt:", error);
      exit();
    }
  };

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
      topicsPerDebate: cliArgs.topics || 5,
      turnsPerTopic: cliArgs.turns || 3,
      humanCoachEnabled: cliArgs.humanCoach ?? false,
      selfImprove: cliArgs.selfImprove ?? true,
      issueFocus: issues.length > 0 ? issues : undefined,
      modelId,
      seed1: cliArgs.seed1,
      seed2: cliArgs.seed2,
      directPrompt1: cliArgs.directPrompt1,
      directPrompt2: cliArgs.directPrompt2,
      narrate: cliArgs.narrate ?? false,
      judgeSeed: cliArgs.judgeSeed,
      humanSide: cliArgs.humanSide,
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

  const handleNaturalLanguage = async (parsed: ParsedMatchConfig) => {
    // This is only called when both speakers are present (checked by SpeakerInput)
    if (!parsed.speaker1 || !parsed.speaker2) return;

    // Generate short display names from the parsed personas
    const [name1, name2] = await generateDisplayNames(parsed.speaker1, parsed.speaker2, modelId);

    // Skip wizard, go directly to running
    setWizard((prev) => ({ ...prev, step: "ready" }));

    const matchConfig: MatchConfig = {
      speaker1Name: name1,
      speaker2Name: name2,
      speaker1Persona: parsed.speaker1,
      speaker2Persona: parsed.speaker2,
      totalDebates: parsed.totalDebates,
      topicsPerDebate: parsed.topicsPerDebate,
      turnsPerTopic: parsed.turnsPerTopic,
      humanCoachEnabled: false,
      selfImprove: true,
      issueFocus: parsed.issueFocus,
      modelId,
      narrate: parsed.narrate,
    };

    try {
      await runMatch(matchConfig, callbacks);
    } catch (error) {
      console.error("Failed to run match:", error);
    }
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
      topicsPerDebate: wizard.topicCount,
      turnsPerTopic: wizard.turnsPerTopic,
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

  const handleSettings = (turns: number, topicCount: number, debateCount: number) => {
    setWizard((prev) => ({
      ...prev,
      turnsPerTopic: turns,
      topicCount,
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
      topicsPerDebate: wizard.topicCount,
      turnsPerTopic: wizard.turnsPerTopic,
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
  // Show wizard if no CLI automation mode is active
  if (!cliArgs?.speaker1 && !cliArgs?.prompt && !cliArgs?.resume && wizard.step !== "ready") {
    return (
      <Box flexDirection="column" padding={1}>
        <Box marginBottom={1}>
          <Text bold color="white">Open Debate</Text>
          <Text dimColor> - AI Debate Arena</Text>
        </Box>

        {wizard.step === "speakers" && (
          <SpeakerInput
            onComplete={handleSpeakers}
            onNaturalLanguage={handleNaturalLanguage}
            modelId={modelId}
          />
        )}
        {wizard.step === "confirm" && (
          <ConfirmStart
            speaker1Name={wizard.speaker1Name}
            speaker2Name={wizard.speaker2Name}
            turns={wizard.turnsPerTopic}
            topics={wizard.topicCount}
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
      topicStates={topicStates}
      phase={phase}
      debateResults={debateResults}
      matchSummary={matchSummary}
      humanInputContext={humanInputContext}
      onHumanResponse={handleHumanResponse}
      humanContinueContext={humanContinueContext}
      onHumanContinue={handleHumanContinue}
      onHintRequest={handleHintRequest}
    />
  );
}
