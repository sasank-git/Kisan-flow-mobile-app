import { Type } from '@google/genai';

// Gemini function-declaration schema. Keep names/args in sync with
// executeTool() in tools.ts and with the Python voice-agent tool set later.
export const agentToolDeclarations = [
  {
    name: 'list_centres',
    description:
      'Get live status of all nearby mandi (procurement) centres — queue length, wait time, congestion level, open/closed.',
    parameters: {
      type: Type.OBJECT,
      properties: {},
    },
  },
  {
    name: 'get_my_bookings',
    description: "Get the current farmer's existing slot bookings / tokens, including status.",
    parameters: {
      type: Type.OBJECT,
      properties: {},
    },
  },
  {
    name: 'recommend_centre',
    description:
      'Get an AI-recommended centre and time slot for a given crop type and quantity, based on live queue/wait data.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        cropType: { type: Type.STRING, description: 'e.g. "Wheat (Sharbati)"' },
        quantity: { type: Type.NUMBER, description: 'Estimated quantity in quintals' },
      },
      required: ['cropType', 'quantity'],
    },
  },
  {
    name: 'rag_query',
    description:
      'Answer general informational questions — MSP rates, procurement rules, grading policy, government schemes, how the mandi process works — using the knowledge base. Use this for anything that is not about booking or checking a specific slot.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        question: { type: Type.STRING },
      },
      required: ['question'],
    },
  },
  {
    name: 'propose_booking',
    description:
      'Create a DRAFT booking proposal for the user to review. This does NOT book anything. Always call this before confirm_booking, and always show the user what you are proposing before asking them to confirm.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        centreId: { type: Type.STRING },
        cropType: { type: Type.STRING },
        variety: { type: Type.STRING },
        quantity: { type: Type.NUMBER, description: 'in quintals' },
        date: { type: Type.STRING, description: '"Today", "Tomorrow", or YYYY-MM-DD' },
        time: { type: Type.STRING, description: 'e.g. "11:30 AM"' },
      },
      required: ['centreId', 'cropType', 'variety', 'quantity', 'date', 'time'],
    },
  },
  {
    name: 'confirm_booking',
    description:
      'Finalize and actually book a slot. ONLY call this after the user has explicitly confirmed THAT SPECIFIC draftId in a following message (e.g. "yes book it", "confirm", "go ahead"). Never call this in the same turn as propose_booking, and never call it speculatively.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        draftId: { type: Type.STRING },
      },
      required: ['draftId'],
    },
  },
];

export const AGENT_SYSTEM_PROMPT = `You are KisanFlow's assistant. You help farmers understand mandi procurement, check queue/wait status, get slot recommendations, and book slots. You also answer general questions like a normal helpful assistant.

RULES:
1. For general/informational questions (MSP rates, rules, schemes, crop grading, "how does this work") -> use rag_query.
2. For "book me a slot" style requests -> first make sure you know cropType and quantity (ask if missing), call recommend_centre, then call propose_booking. Do NOT call confirm_booking in the same turn you called propose_booking.
3. confirm_booking may ONLY be called after the user has clearly confirmed THAT SPECIFIC draft in a later message (a tapped confirm button will appear to you as a user message like "Confirm booking <draftId>", or a clear verbal/text "yes, book it").
4. If the user wants to change something about a pending draft ("I want 3pm instead", "make it centre B"), call propose_booking again with a NEW draft. Do not reuse the old draftId.
5. Before asking for confirmation, always clearly restate what you are about to book: centre, crop, quantity, date, time.
6. Keep replies concise and conversational, like natural spoken/texted language — NOT a formal form or numbered checklist.
   - Never use numbered lists (1. 2. 3.), bullet points, or markdown formatting in your replies.
   - If you need multiple pieces of info, ask for them in one flowing sentence, e.g. "Sure! What crop are you bringing, and roughly how many quintals?" instead of listing them as separate numbered questions.
   - Do not invent centre IDs, wait times, or MSP rates — always get them from a tool call.`;