import { GoogleGenAI } from '@google/genai';
import { agentToolDeclarations, AGENT_SYSTEM_PROMPT } from './toolSchema';
import { executeTool, AgentToolContext, BookingDraft } from './tools';

const apiKey = import.meta.env.VITE_GOOGLE_GENAI_API_KEY || '';
if (!apiKey) {
  console.warn('⚠️ VITE_GOOGLE_GENAI_API_KEY is not set in .env file!');
}
const ai = new GoogleGenAI({ apiKey });

// ---------------------------------------------------------------------------
// Chat message shape used by the UI. `draft` is attached when the agent's
// turn produced a propose_booking result, so the UI can render a review
// card with a real Confirm button instead of the user having to type "yes".
// ---------------------------------------------------------------------------
export interface AgentChatMessage {
  role: 'user' | 'agent';
  text: string;
  draft?: BookingDraft;
}

// Internal Gemini "contents" history — kept separate from AgentChatMessage
// so tool calls/results don't leak into the UI transcript.
type GeminiContent = {
  role: 'user' | 'model';
  parts: any[];
};

const MAX_TOOL_ROUNDS = 6;

export async function runAgentTurn(
  history: GeminiContent[],
  userMessage: string,
  ctx: AgentToolContext
): Promise<{ reply: string; draft?: BookingDraft; updatedHistory: GeminiContent[] }> {
  const contents: GeminiContent[] = [
    ...history,
    { role: 'user', parts: [{ text: userMessage }] },
  ];

  let lastDraft: BookingDraft | undefined;

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const result = await ai.models.generateContent({
      model: 'gemini-3.5-flash-lite',
      contents,
      config: {
        systemInstruction: AGENT_SYSTEM_PROMPT,
        tools: [{ functionDeclarations: agentToolDeclarations }],
      },
    });

    const candidate = result.candidates?.[0];
    const parts = candidate?.content?.parts ?? [];

    const functionCalls = parts.filter((p: any) => p.functionCall);

    if (functionCalls.length === 0) {
      // No tool calls — this is the final text reply for the turn.
      const text = parts.map((p: any) => p.text ?? '').join('').trim();
      contents.push({ role: 'model', parts });
      return { reply: text || "Sorry, I didn't catch that — could you rephrase?", draft: lastDraft, updatedHistory: contents };
    }

    // Model wants to call one or more tools. Record its turn, then execute
    // each call and feed results back as functionResponse parts.
    contents.push({ role: 'model', parts });

    const responseParts: any[] = [];
    for (const fc of functionCalls) {
      const { name, args } = fc.functionCall;
      let toolResult: any;
      try {
        toolResult = await executeTool(name, args ?? {}, ctx);
      } catch (err: any) {
        toolResult = { error: err?.message ?? 'Tool execution failed.' };
      }

      if (name === 'propose_booking' && toolResult && !toolResult.error) {
        lastDraft = toolResult as BookingDraft;
      }
      if (name === 'confirm_booking') {
        // Booking either succeeded or failed — either way the draft is
        // resolved, so clear it from the UI state.
        lastDraft = undefined;
      }

      responseParts.push({
        functionResponse: {
          name,
          response: { result: toolResult },
        },
      });
    }

    contents.push({ role: 'user', parts: responseParts });
  }

  // Safety valve — shouldn't normally hit this.
  return {
    reply: "I'm having trouble completing that request right now. Could you try again?",
    draft: lastDraft,
    updatedHistory: contents,
  };
}

// ---------------------------------------------------------------------------
// Convenience wrapper for a UI-facing chat hook: keeps Gemini history
// internally, exposes a simple send(text) -> AgentChatMessage API.
//
// Pass `initialHistory` (loaded from localStorage) to resume a session with
// real memory intact, not just replayed UI bubbles. Use `session.getHistory()`
// after each send() to persist it back.
// ---------------------------------------------------------------------------
export function createAgentSession(
  ctx: AgentToolContext,
  initialHistory: GeminiContent[] = []
) {
  let history: GeminiContent[] = initialHistory;

  return {
    async send(userMessage: string): Promise<AgentChatMessage> {
      const { reply, draft, updatedHistory } = await runAgentTurn(history, userMessage, ctx);
      history = updatedHistory;
      return { role: 'agent', text: reply, draft };
    },

    /** Call this when the user taps "Confirm" on a rendered draft card,
     * without them having to type anything. */
    async confirmDraft(draftId: string): Promise<AgentChatMessage> {
      return this.send(`Confirm booking ${draftId}`);
    },

    /** Serializable Gemini history — persist this (e.g. to localStorage)
     * to survive reloads with real conversational memory, not just a
     * replayed transcript. */
    getHistory(): GeminiContent[] {
      return history;
    },

    reset() {
      history = [];
    },
  };
}

export type { GeminiContent };