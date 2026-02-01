import { generateText } from "ai";
import { getModel } from "./model-provider.js";
import type { Exchange } from "../types/debate.js";

export interface CoachContext {
  question: string;
  speakerName: string;
  speakerPersona: string;
  exchanges: Exchange[];
  roundNumber: number;
  totalRounds: number;
}

export interface CoachMessage {
  role: "user" | "coach";
  content: string;
}

export interface CoachRequest {
  context: CoachContext;
  userRequest?: string; // Optional specific request from user
  conversationHistory: CoachMessage[]; // Previous exchanges with coach
  modelId: string;
}

export async function getDebateCoaching(request: CoachRequest): Promise<string> {
  const { context, userRequest, conversationHistory, modelId } = request;
  const { question, speakerName, speakerPersona, exchanges, roundNumber, totalRounds } = context;

  const transcript = exchanges.length > 0
    ? exchanges.map(ex => `${ex.speakerName} (Round ${ex.roundNumber}):\n${ex.message}`).join("\n\n")
    : "(No exchanges yet - you speak first)";

  const lastOpponentMessage = exchanges.length > 0
    ? exchanges.filter(ex => ex.speakerName !== speakerName).slice(-1)[0]?.message
    : null;

  const systemPrompt = `You are a world-class debate coach. Your debater is "${speakerName}" arguing the position: "${speakerPersona}".

DEBATE CONTEXT:
Question: ${question}
Round: ${roundNumber}/${totalRounds}
${lastOpponentMessage ? `\nOpponent's last argument:\n${lastOpponentMessage}` : ""}

FULL TRANSCRIPT:
${transcript}

RULES:
- Be concise and propositional - state claims directly
- No fluff, no encouragement, just strategic substance
- If reviewing a draft, be critical and constructive
- If brainstorming, develop the debater's direction
- Keep total response under 200 words`;

  // Build messages array for conversation
  const messages: Array<{ role: "user" | "assistant"; content: string }> = [];

  // Add conversation history
  for (const msg of conversationHistory) {
    messages.push({
      role: msg.role === "user" ? "user" : "assistant",
      content: msg.content,
    });
  }

  // Add current request
  const currentMessage = userRequest
    ? userRequest
    : `Suggest 3 strong arguments or angles I could use right now. Consider what the opponent said, what hasn't been addressed, and what would be most persuasive.`;

  messages.push({ role: "user", content: currentMessage });

  const { text } = await generateText({
    model: getModel(modelId),
    system: systemPrompt,
    messages,
  });

  return text.trim();
}
