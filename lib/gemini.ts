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

  try {
    return JSON.parse(cleaned);
  } catch {
    const match = cleaned.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
    if (match) {
      return JSON.parse(match[0]);
    }
    throw new Error('Failed to parse Gemini output as JSON: ' + text);
  }
}

export interface PreliminaryCareAllopathy {
  immediateSteps: string[];
  warningSigns: string[];
}

export interface PreliminaryCareAyurveda {
  homeRemedies: string[];
  dietaryAdvice: string[];
}

export interface PreVisitSummaryData {
  urgencyLevel: 'Low' | 'Medium' | 'High';
  chiefComplaint: string;
  preliminaryCare?: {
    alopathy: PreliminaryCareAllopathy;
    ayurveda: PreliminaryCareAyurveda;
  };
  suggestedQuestions: string[];
  disclaimer?: string;
}

export type PreVisitSummaryResponse = PreVisitSummaryData | { error: string };

// ─────────────────────────────────────────────
// Pre-visit summary
// Provides urgency, chief complaint, doctor questions,
// and safe preliminary steps based on both Ayurveda and Allopathy.
// On failure: returns error sentinel object and logs appointmentId.
// ─────────────────────────────────────────────
export async function generatePreVisitSummary(
  symptoms: string,
  appointmentId: string
): Promise<PreVisitSummaryResponse> {
  const prompt = `You are a clinical integrative AI medical assistant.
Analyze these patient symptoms: "${symptoms}".

Provide:
1. Urgency level: "Low", "Medium", or "High".
2. Chief complaint: A concise summary of the primary symptoms.
3. Preliminary care steps the patient can safely follow at home BEFORE their doctor appointment, covering both:
   - Allopathy (Modern Medicine): safe first-aid/home relief measures (e.g., hydration, temperature tracking, rest) and red-flag warning signs that require emergency care.
   - Ayurveda (Traditional Holistic Health): safe herbal kitchen remedies (e.g., tulsi, ginger, turmeric decoction/kadha) and dietary/lifestyle guidance (light warm food, digestion support).
4. Three suggested questions for the patient to ask their doctor during the consultation.
5. A concise medical disclaimer.

Return ONLY a single valid JSON object with this exact structure:
{
  "urgencyLevel": "Low",
  "chiefComplaint": "string",
  "preliminaryCare": {
    "alopathy": {
      "immediateSteps": ["step 1", "step 2", "step 3"],
      "warningSigns": ["warning 1", "warning 2"]
    },
    "ayurveda": {
      "homeRemedies": ["remedy 1", "remedy 2"],
      "dietaryAdvice": ["advice 1", "advice 2"]
    }
  },
  "suggestedQuestions": ["question 1", "question 2", "question 3"],
  "disclaimer": "These preliminary steps are for supportive comfort before your appointment and do not replace professional medical evaluation."
}`;

  try {
    const result = await callGemini(prompt);
    return result as PreVisitSummaryData;
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
