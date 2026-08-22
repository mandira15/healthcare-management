import { GoogleGenerativeAI } from '@google/generative-ai';

// Singleton Gemini client
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
const model = genAI.getGenerativeModel({ model: 'gemini-3.6-flash' });

// ─────────────────────────────────────────────
// Generic Gemini caller
// Always wrapped in try/catch — AI must never block core logic.
// ─────────────────────────────────────────────
async function callGemini(prompt: string): Promise<unknown> {
  const result = await model.generateContent(prompt);
  const text = result.response.text();

  // Strip markdown code fences if Gemini wraps JSON in ```json ... ```
  const cleaned = text
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/, '')
    .trim();

  return JSON.parse(cleaned);
}

// ─────────────────────────────────────────────
// Pre-visit summary
// Exact prompt from spec — strict JSON requested.
// On failure: returns error sentinel object and logs appointmentId.
// ─────────────────────────────────────────────
export async function generatePreVisitSummary(
  symptoms: string,
  appointmentId: string
): Promise<{
  urgencyLevel: 'Low' | 'Medium' | 'High';
  chiefComplaint: string;
  suggestedQuestions: [string, string, string];
} | { error: string }> {
  const prompt = `Analyse these symptoms and return: urgency level (Low/Medium/High), chief complaint, and three suggested questions for the doctor. Symptoms: ${symptoms}

Return ONLY valid JSON matching exactly:
{"urgencyLevel":"Low|Medium|High","chiefComplaint":"string","suggestedQuestions":["string","string","string"]}`;

  try {
    const result = await callGemini(prompt);
    return result as {
      urgencyLevel: 'Low' | 'Medium' | 'High';
      chiefComplaint: string;
      suggestedQuestions: [string, string, string];
    };
  } catch (err) {
    // Log with appointmentId for traceability — AI failure must not block booking
    console.error(
      `[Gemini] Pre-visit summary failed for appointment ${appointmentId}:`,
      err
    );
    return { error: 'AI summary unavailable, please review manually' };
  }
}

// ─────────────────────────────────────────────
// Post-visit summary
// Exact prompt from spec — strict JSON requested.
// On failure: returns error sentinel + logs appointmentId.
// ─────────────────────────────────────────────
export async function generatePostVisitSummary(
  notes: string,
  appointmentId: string
): Promise<{
  summary: string;
  medicationSchedule: Array<{ medicine: string; dosage: string; frequency: string }>;
  followUpSteps: string[];
} | { error: string }> {
  const prompt = `Convert these clinical notes into a patient-friendly summary with medication schedule and follow-up steps: ${notes}

Return ONLY valid JSON matching exactly:
{"summary":"string","medicationSchedule":[{"medicine":"string","dosage":"string","frequency":"string"}],"followUpSteps":["string"]}`;

  try {
    const result = await callGemini(prompt);
    return result as {
      summary: string;
      medicationSchedule: Array<{ medicine: string; dosage: string; frequency: string }>;
      followUpSteps: string[];
    };
  } catch (err) {
    console.error(
      `[Gemini] Post-visit summary failed for appointment ${appointmentId}:`,
      err
    );
    return { error: 'AI summary unavailable, please review manually' };
  }
}
