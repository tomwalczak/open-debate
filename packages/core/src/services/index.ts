export { getModel, DEFAULT_MODEL_ID, MODEL_REGISTRY, type ModelInfo } from "./model-provider.js";
export { generateInitialPrompt, createJudgeAgent } from "./agent-factory.js";
export { updateAgentAfterDebate } from "./agent-learner.js";
export { generateTopics, refineTopics } from "./topic-generator.js";
export { judgeTopic, calculateFinalTally } from "./judge-service.js";
export {
  createMatch,
  saveDebateResult,
  appendAgentLearnings,
  readAgentLearnings,
  saveAgentPrompt,
  generatePromptFromLearnings,
} from "./match-storage.js";
export { runMatch, resumeMatch, type MatchCallbacks, type HumanInputContext, type HumanContinueContext } from "./match-engine.js";
export { narrateExchange } from "./narrator.js";
export { parseMatchPrompt, type ParsedMatchConfig } from "./prompt-parser.js";
export { generateDisplayNames, generateDisplayName } from "./name-generator.js";
export { getDebateCoaching, type CoachContext, type CoachRequest, type CoachMessage } from "./debate-coach.js";
