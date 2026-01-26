import React, { useState, useCallback, useEffect } from "react";
import { Box, Text, useApp } from "ink";
import {
  SpeakerInput,
  SettingsInput,
  TopicFocusInput,
  QuestionReview,
  CoachToggle,
  ParallelDebateView,
  TabBar,
  Spinner,
} from "./components/index.js";
import {
  initializeParallelDebate,
  runParallelDebate,
  completeParallelDebateWithHumanFeedback,
} from "./services/parallel-debate-engine.js";
import { generateQuestions, refineQuestions } from "./services/question-generator.js";
import type { DebateState, WizardState, DebateConfig, QuestionExecutionState } from "./types/debate.js";
import { DEFAULT_WIZARD_STATE } from "./types/debate.js";
import { DEFAULT_MODEL_ID } from "./types/agent.js";

const isTTY = process.stdin.isTTY;

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

export function App({ cliArgs }: AppProps) {
  const { exit } = useApp();
  const [wizard, setWizard] = useState<WizardState>(DEFAULT_WIZARD_STATE);
  const [debates, setDebates] = useState<DebateState[]>([]);
  const [activeDebateIndex, setActiveDebateIndex] = useState(0);
  const [questionStates, setQuestionStates] = useState<Map<number, QuestionExecutionState>>(new Map());
  const [isLoading, setIsLoading] = useState(false);
  const [debatesRemaining, setDebatesRemaining] = useState(cliArgs?.debates || 1);
  const [modelId] = useState(cliArgs?.model || DEFAULT_MODEL_ID);

  const activeDebate = debates[activeDebateIndex];

  const callbacks = {
    onStateChange: (state: DebateState) => {
      setDebates((prev) => {
        const index = prev.findIndex((d) => d.id === state.id);
        if (index >= 0) {
          const newDebates = [...prev];
          newDebates[index] = state;
          return newDebates;
        }
        return [...prev, state];
      });
    },
    onQuestionStateChange: (questionState: QuestionExecutionState) => {
      setQuestionStates((prev) => {
        const newMap = new Map(prev);
        newMap.set(questionState.questionIndex, questionState);
        return newMap;
      });
    },
    onQuestionStreamChunk: (_questionIndex: number, _chunk: string) => {
      // Streaming is handled via onQuestionStateChange
    },
    onError: (error: Error) => {
      console.error("Debate error:", error);
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

    setIsLoading(true);
    const issues = cliArgs.issues?.split(",").map((s) => s.trim()) || [];

    try {
      const questions = await generateQuestions({
        speaker1Name: cliArgs.speaker1,
        speaker2Name: cliArgs.speaker2,
        count: cliArgs.questions || 5,
        issueFocus: issues,
        modelId,
      });

      const config: DebateConfig = {
        questions,
        roundsPerQuestion: cliArgs.rounds || 3,
        humanCoachEnabled: cliArgs.humanCoach ?? false,
        issueFocus: issues,
      };

      await startDebate(cliArgs.speaker1, cliArgs.speaker2, config, cliArgs.fork ?? false);
    } catch (error) {
      console.error("Failed to start debate:", error);
      exit();
    }
  };

  const startDebate = async (
    speaker1: string,
    speaker2: string,
    config: DebateConfig,
    fork: boolean = false
  ) => {
    setIsLoading(true);
    setQuestionStates(new Map());

    try {
      const initialState = initializeParallelDebate(
        speaker1,
        speaker2,
        config,
        modelId,
        callbacks,
        fork
      );

      setDebates([initialState]);
      setActiveDebateIndex(0);
      setIsLoading(false);

      // Run the debate in parallel
      const finalState = await runParallelDebate(initialState, callbacks, cliArgs?.selfImprove ?? false);

      // If autopilot and more debates remaining, start another
      if (cliArgs?.autopilot && debatesRemaining > 1) {
        setDebatesRemaining((prev) => prev - 1);
        // Start another debate after a short delay
        setTimeout(() => {
          handleCliAutomation();
        }, 1000);
      }
    } catch (error) {
      console.error("Failed to run debate:", error);
      setIsLoading(false);
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

  const handleSettings = (rounds: number, questionCount: number) => {
    setWizard((prev) => ({
      ...prev,
      roundsPerQuestion: rounds,
      questionCount,
      step: "topic_focus",
    }));
  };

  const handleTopicFocus = async (topics: string[]) => {
    setWizard((prev) => ({
      ...prev,
      issueFocus: topics,
      step: "question_review",
    }));

    setIsLoading(true);
    try {
      const questions = await generateQuestions({
        speaker1Name: wizard.speaker1Name,
        speaker2Name: wizard.speaker2Name,
        count: wizard.questionCount,
        issueFocus: topics,
        modelId,
      });
      setWizard((prev) => ({ ...prev, questions }));
    } catch (error) {
      console.error("Failed to generate questions:", error);
    }
    setIsLoading(false);
  };

  const handleQuestionRefine = async (command: string) => {
    setIsLoading(true);
    try {
      const newQuestions = await refineQuestions(
        wizard.questions,
        command,
        wizard.speaker1Name,
        wizard.speaker2Name,
        modelId
      );
      setWizard((prev) => ({ ...prev, questions: newQuestions }));
    } catch (error) {
      console.error("Failed to refine questions:", error);
    }
    setIsLoading(false);
  };

  const handleQuestionApprove = () => {
    setWizard((prev) => ({ ...prev, step: "coach_toggle" }));
  };

  const handleCoachToggle = async (enabled: boolean) => {
    setWizard((prev) => ({
      ...prev,
      humanCoachEnabled: enabled,
      step: "ready",
    }));

    const config: DebateConfig = {
      questions: wizard.questions,
      roundsPerQuestion: wizard.roundsPerQuestion,
      humanCoachEnabled: enabled,
      issueFocus: wizard.issueFocus,
    };

    await startDebate(wizard.speaker1Name, wizard.speaker2Name, config);
  };

  const handleHumanFeedback = async (feedback: string) => {
    if (activeDebate) {
      await completeParallelDebateWithHumanFeedback(activeDebate, feedback, callbacks, cliArgs?.selfImprove ?? false);
    }
  };

  // Note: Ctrl+C handling is automatic via Ink when in TTY mode

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
        {wizard.step === "question_review" && (
          <QuestionReview
            questions={wizard.questions}
            isLoading={isLoading}
            onApprove={handleQuestionApprove}
            onRefine={handleQuestionRefine}
          />
        )}
        {wizard.step === "coach_toggle" && <CoachToggle onComplete={handleCoachToggle} />}
      </Box>
    );
  }

  // Loading state
  if (isLoading && debates.length === 0) {
    return (
      <Box padding={1}>
        <Spinner label="Initializing debate..." />
      </Box>
    );
  }

  // Debate view
  if (activeDebate) {
    return (
      <Box flexDirection="column">
        <TabBar
          debates={debates}
          activeIndex={activeDebateIndex}
          onSwitch={setActiveDebateIndex}
        />
        <ParallelDebateView
          state={activeDebate}
          questionStates={questionStates}
          onHumanFeedback={handleHumanFeedback}
        />
      </Box>
    );
  }

  return (
    <Box padding={1}>
      <Spinner label="Starting..." />
    </Box>
  );
}
