import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionUser } from '@/lib/auth';
import {
  RED_FLAG_SYMPTOMS,
  CONDITION_GUIDANCE_MAP,
  SUPPORTED_SYMPTOMS,
} from '@/lib/stomachHealth';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { symptoms = [], redFlags = [], duration = '1-2 days', severity = 'mild' } = body;

    // Optional user authentication check
    let userId: string | null = null;
    try {
      const user = await getSessionUser();
      if (user?.userId) {
        userId = user.userId;
      }
    } catch {
      // Continue if not authenticated
    }

    // Input validation
    if (!Array.isArray(symptoms)) {
      return NextResponse.json(
        { error: 'Invalid symptoms payload. Expected an array of symptoms.' },
        { status: 400 }
      );
    }

    // ─────────────────────────────────────────────
    // STEP 1: SAFETY LAYER - RED FLAG INSPECTION
    // Evaluates critical warning symptoms before regular ML inference
    // ─────────────────────────────────────────────
    const identifiedRedFlags = RED_FLAG_SYMPTOMS.filter(rf =>
      Array.isArray(redFlags) && redFlags.includes(rf.id)
    );

    if (identifiedRedFlags.length > 0) {
      // Record analysis history in DB if user is authenticated
      if (userId) {
        try {
          await prisma.symptomAnalysis.create({
            data: {
              userId,
              symptoms: JSON.stringify(symptoms),
              prediction: 'RED_FLAG_ALERT',
              confidence: 1.0,
              severity: String(severity),
              duration: String(duration),
              isRedFlag: true,
            },
          });
        } catch (dbErr) {
          console.warn('[StomachAnalysis] DB log failed:', dbErr);
        }
      }

      return NextResponse.json({
        isRedFlag: true,
        redFlagWarnings: identifiedRedFlags.map(rf => ({
          id: rf.id,
          label: rf.label,
          warning: rf.warningText,
        })),
        safetyNotice:
          '⚠️ Some of the symptoms you reported require prompt medical evaluation. Please contact a qualified healthcare professional or seek emergency medical care immediately.',
        recommendedAction: 'Seek Immediate Medical Attention',
        suggestedSpecialty: 'Gastroenterologist',
        disclaimer:
          'This tool provides general triage information and is NOT a medical diagnosis or substitute for professional emergency medical evaluation.',
      });
    }

    // Ensure at least one stomach symptom was selected
    if (symptoms.length === 0) {
      return NextResponse.json(
        { error: 'Please select at least one symptom to analyze.' },
        { status: 400 }
      );
    }

    // ─────────────────────────────────────────────
    // STEP 2: PYTHON ML PREDICTION MICROSERVICE CALL
    // Communicates with FastAPI ML inference server
    // ─────────────────────────────────────────────
    const mlServiceUrl = process.env.ML_SERVICE_URL || 'http://127.0.0.1:8000';
    let mlResult: {
      prediction: string;
      confidence: number;
      probabilities: Record<string, number>;
      model_name: string;
      matched_symptoms: string[];
    };

    try {
      const mlRes = await fetch(`${mlServiceUrl}/predict`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symptoms,
          duration,
          severity,
        }),
        signal: AbortSignal.timeout(6000), // 6-second timeout
      });

      if (!mlRes.ok) {
        const errData = await mlRes.json().catch(() => ({}));
        throw new Error(errData.detail || `ML service returned status ${mlRes.status}`);
      }

      mlResult = await mlRes.json();
    } catch (mlErr: any) {
      console.warn('[StomachAnalysis] ML microservice call error:', mlErr?.message);

      // Return a graceful graceful fallback response if Python ML service is offline
      return NextResponse.json(
        {
          error:
            'The Machine Learning service is currently starting or unavailable. Please ensure the Python ML service is running at ' +
            mlServiceUrl,
          serviceUnavailable: true,
        },
        { status: 503 }
      );
    }

    // ─────────────────────────────────────────────
    // STEP 3: ENRICH PREDICTION WITH CLINICAL GUIDANCE
    // ─────────────────────────────────────────────
    const guidance = CONDITION_GUIDANCE_MAP[mlResult.prediction] || {
      condition: mlResult.prediction,
      displayName: mlResult.prediction,
      description: 'Digestive tract health condition.',
      suggestedSpecialty: 'Gastroenterologist',
      generalGuidance: [
        'Stay adequately hydrated with water and electrolytes.',
        'Prefer smaller, lighter, easily digestible meals.',
        'Avoid known triggers (excessively spicy, greasy, or acidic foods).',
        'Monitor your symptoms closely over the next 24 to 48 hours.',
      ],
      whenToConsult: [
        'If symptoms persist for several days or progressively worsen.',
        'If severe abdominal pain, high fever, or vomiting occurs.',
      ],
    };

    // Human-readable labels for selected symptoms
    const matchedSymptomLabels = mlResult.matched_symptoms.map(sId => {
      const found = SUPPORTED_SYMPTOMS.find(s => s.id === sId);
      return found ? found.label : sId;
    });

    // Save analysis record in database
    if (userId) {
      try {
        await prisma.symptomAnalysis.create({
          data: {
            userId,
            symptoms: JSON.stringify(symptoms),
            prediction: mlResult.prediction,
            confidence: mlResult.confidence,
            severity: String(severity),
            duration: String(duration),
            isRedFlag: false,
          },
        });
      } catch (dbErr) {
        console.warn('[StomachAnalysis] DB save failed:', dbErr);
      }
    }

    return NextResponse.json({
      isRedFlag: false,
      prediction: mlResult.prediction,
      displayName: guidance.displayName,
      description: guidance.description,
      confidence: mlResult.confidence,
      confidencePercentage: Math.round(mlResult.confidence * 100),
      probabilities: mlResult.probabilities,
      modelName: mlResult.model_name,
      matchedSymptoms: matchedSymptomLabels,
      duration,
      severity,
      generalGuidance: guidance.generalGuidance,
      whenToConsult: guidance.whenToConsult,
      suggestedSpecialty: guidance.suggestedSpecialty,
      disclaimer:
        'This tool provides general health information and is NOT a medical diagnosis. Please consult a qualified healthcare professional for diagnosis, clinical evaluation, and medical treatment.',
    });
  } catch (error: any) {
    console.error('[StomachAnalysis] Server error:', error);
    return NextResponse.json(
      { error: 'An unexpected internal error occurred during symptom analysis.' },
      { status: 500 }
    );
  }
}
