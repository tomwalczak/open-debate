export { getModel, DEFAULT_MODEL_ID, MODEL_REGISTRY, type ModelInfo } from "./model-provider.js";
export { generateInitialPrompt, createJudgeAgent } from "./agent-factory.js";
export { updateAgentAfterDebate } from "./agent-learner.js";
export { generateQuestions, refineQuestions } from "./question-generator.js";
export { judgeQuestion, calculateFinalTally } from "./judge-service.js";
export {
  createMatch,
  saveDebateResult,
  appendAgentLearnings,
  readAgentLearnings,
  saveAgentPrompt,
  generatePromptFromLearnings,
} from "./match-storage.js";
export { runMatch, type MatchCallbacks } from "./match-engine.js";
export { narrateExchange } from "./narrator.js";
export { parseMatchPrompt, type ParsedMatchConfig } from "./prompt-parser.js";
