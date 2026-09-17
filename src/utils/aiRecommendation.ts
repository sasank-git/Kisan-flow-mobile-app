import { GoogleGenAI } from "@google/genai";
import { ProcurementCentre, FarmerProfile } from "../types";

// Initialize Gemini AI with API key from .env
const apiKey = import.meta.env.VITE_GOOGLE_GENAI_API_KEY || "";

if (!apiKey) {
  console.warn("⚠️ VITE_GOOGLE_GENAI_API_KEY is not set in .env file!");
}

const ai = new GoogleGenAI({ apiKey });

interface RecommendationInput {
  farmer: FarmerProfile;
  centres: ProcurementCentre[];
  cropType: string;
  quantity: number;
  preferredTime?: string;
}

interface Recommendation {
  recommendedCentreId: string;
  recommendedTime: string;
  expectedWaitMin: number;
  loadScore: number;
  reasoning: string;
  source: "ai" | "fallback"; // ADD THIS
}

export async function getAISlotRecommendation(
  input: RecommendationInput
): Promise<Recommendation | null> {
  try {
    // Format centre data for AI analysis
    const centresData = input.centres
      .map(
        (c) => `
  - ${c.name} (${c.distanceKm}km away):
    Queue: ${c.currentQueue} farmers
    Wait time: ~${c.waitTimeMin} mins
    Capacity today: ${c.todayBooked}/${c.maxDailyCapacity}
    Active counters: ${c.activeCounters}/${c.totalCounters}
    Congestion level: ${c.congestion}
    Status: ${c.isOpen ? "OPEN" : "CLOSED"}
`
      )
      .join("");

    const prompt = `
You are an AI optimization engine for Indian grain procurement (Mandi) centres.
A farmer wants to book a slot for grain procurement.

FARMER DETAILS:
- Name: ${input.farmer.name}
- Village: ${input.farmer.village}
- Land size: ${input.farmer.landSizeAcres} acres
- Preferred language: ${input.farmer.preferredLang}

CROP DETAILS:
- Type: ${input.cropType}
- Estimated quantity: ${input.quantity} Quintals

AVAILABLE CENTRES STATUS (RIGHT NOW):
${centresData}

OPTIMIZATION CRITERIA (in order of priority):
1. Minimize wait time (queue + processing time)
2. Maximize active counters for faster throughput
3. Reduce travel distance (fuel + time cost)
4. Avoid HIGH congestion peaks
5. Ensure centre is open

TASK: Analyze the data above and recommend the BEST centre and time slot for this farmer.

RESPOND ONLY WITH VALID JSON (no markdown, no extra text):
{
  "recommendedCentreId": "centre-a OR centre-b OR centre-c",
  "recommendedTime": "HH:MM AM/PM",
  "expectedWaitMin": <number>,
  "loadScore": <number 0-100 where lower is better>,
  "reasoning": "<2-3 sentence explanation>"
}
`;

    console.log("🤖 Calling Gemini AI for slot recommendation...");

    const result = await ai.models.generateContent({
      model: "gemini-3.5-flash-lite",   // updated from gemini-2.0-flash / gemini-3.6-flash
      contents: prompt,
    });
    const responseText = result.text ?? "";

    console.log("📝 AI Response:", responseText);

    // Extract JSON from response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.warn("⚠️ No JSON found in AI response");
      return getFallbackRecommendation(input);
    }

    const recommendation: Recommendation = { ...JSON.parse(jsonMatch[0]), source: "ai" };
    console.log("✅ AI Recommendation:", recommendation);

    return recommendation;
  } catch (error) {
    console.error("❌ AI Error:", error);
    return getFallbackRecommendation(input);
  }
}

// Fallback when AI is unavailable
function getFallbackRecommendation(
  input: RecommendationInput
): Recommendation {
  const sorted = [...input.centres].sort(
    (a, b) => a.waitTimeMin - b.waitTimeMin
  );
  const best = sorted[0];

  return {
    recommendedCentreId: best.id,
    recommendedTime: "11:30 AM",
    expectedWaitMin: best.waitTimeMin,
    loadScore: best.currentQueue,
    reasoning: `${best.name} has the lowest queue (${best.currentQueue} farmers) and shortest wait time (~${best.waitTimeMin} mins).`,
    source: "fallback", // ADD THIS
  };
}