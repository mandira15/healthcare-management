/**
 * doctorRanking.ts
 * Transparent doctor recommendation and ranking algorithm.
 *
 * Scoring model (Dynamic multi-factor weighting):
 * - Distance: 30% (when coordinates are available)
 * - Specialization & Health Concern Relevance: 25%
 * - Availability: 20%
 * - Experience: 15% (when available)
 * - Rating: 10% (when available)
 *
 * If distance, experience, or rating is not available, weights are dynamically
 * re-normalized so total score remains accurately on a 0-100 scale.
 */

export interface DoctorScoreFactors {
  distanceKm: number | null;
  maxRadiusKm: number;
  specialization: string;
  searchConcern?: string;
  selectedSpecialty?: string;
  availabilityType: 'today' | 'tomorrow' | 'week' | 'none';
  experienceYears?: number | null;
  rating?: number | null;
}

export interface DoctorScoreResult {
  score: number; // 0 - 100
  scoreLabel: string;
  matchPercentage: number;
  breakdown: {
    distance: number | null;
    relevance: number;
    availability: number;
    experience: number | null;
    rating: number | null;
  };
}

/**
 * Common symptom / health concern to specialization keyword mapping
 * for intelligent health-concern matching.
 */
export const CONCERN_SPECIALTY_MAP: Record<string, string[]> = {
  cardiology: ['heart', 'chest pain', 'blood pressure', 'bp', 'palpitations', 'cholesterol', 'cardiac', 'cardio'],
  dermatology: ['skin', 'rash', 'acne', 'itching', 'hair', 'nails', 'allergy', 'eczema', 'derma'],
  'general practice': ['fever', 'cold', 'cough', 'headache', 'fatigue', 'body ache', 'general', 'flu', 'weakness'],
  'general physician': ['fever', 'cold', 'cough', 'headache', 'fatigue', 'body ache', 'general', 'flu', 'weakness'],
  gastroenterology: ['stomach', 'digestion', 'acidity', 'acid reflux', 'gastric', 'abdomen', 'gut', 'gastro', 'liver', 'nausea'],
  gastroenterologist: ['stomach', 'digestion', 'acidity', 'acid reflux', 'gastric', 'abdomen', 'gut', 'gastro', 'liver', 'nausea'],
  pediatrics: ['child', 'baby', 'infant', 'toddler', 'kids'],
  orthopedics: ['bone', 'joint', 'fracture', 'knee', 'back pain', 'spine', 'shoulder', 'ortho'],
  neurology: ['migraine', 'nerve', 'seizure', 'dizziness', 'numbness', 'brain', 'neuro'],
};

/**
 * Checks whether a search query matches doctor name, clinic, city, address, bio,
 * or known health concern / symptoms associated with the doctor's specialization.
 */
export function matchesDoctorSearch(
  query: string,
  doctor: {
    name: string;
    specialization: string;
    clinicName?: string | null;
    city?: string | null;
    bio?: string | null;
    address?: string | null;
  }
): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;

  if (doctor.name.toLowerCase().includes(q)) return true;
  if (doctor.specialization.toLowerCase().includes(q)) return true;
  if (doctor.clinicName?.toLowerCase().includes(q)) return true;
  if (doctor.city?.toLowerCase().includes(q)) return true;
  if (doctor.address?.toLowerCase().includes(q)) return true;
  if (doctor.bio?.toLowerCase().includes(q)) return true;

  // Check health concern keywords matching doctor's specialization
  const spec = doctor.specialization.toLowerCase();
  for (const [specKey, keywords] of Object.entries(CONCERN_SPECIALTY_MAP)) {
    if (spec.includes(specKey)) {
      if (keywords.some((kw) => q.includes(kw) || kw.includes(q))) {
        return true;
      }
    }
  }

  return false;
}

export function calculateDoctorRecommendationScore(
  factors: DoctorScoreFactors
): DoctorScoreResult {
  let totalActiveWeight = 0;
  let weightedScoreSum = 0;

  // 1. Distance Score (Weight: 30)
  let distanceScore: number | null = null;
  if (factors.distanceKm !== null && factors.distanceKm >= 0) {
    const rawRatio = factors.distanceKm / Math.max(factors.maxRadiusKm, 1);
    // Exponential or linear falloff: 0km = 100, at maxRadius = 30, beyond maxRadius = 0
    distanceScore = Math.max(0, Math.round(100 - rawRatio * 70));
    weightedScoreSum += distanceScore * 0.30;
    totalActiveWeight += 0.30;
  }

  // 2. Specialization & Health Concern Relevance (Weight: 25)
  let relevanceScore = 75; // baseline relevance
  const docSpec = factors.specialization.toLowerCase();
  const search = (factors.searchConcern || '').trim().toLowerCase();
  const filterSpec = (factors.selectedSpecialty || '').trim().toLowerCase();

  if (filterSpec && docSpec.includes(filterSpec)) {
    relevanceScore = 100;
  } else if (search) {
    if (docSpec.includes(search)) {
      relevanceScore = 100;
    } else {
      // Check concern keywords
      let matchedConcern = false;
      for (const [specKey, keywords] of Object.entries(CONCERN_SPECIALTY_MAP)) {
        if (docSpec.includes(specKey)) {
          if (keywords.some((kw) => search.includes(kw) || kw.includes(search))) {
            relevanceScore = 95;
            matchedConcern = true;
            break;
          }
        }
      }
      if (!matchedConcern) {
        relevanceScore = 50;
      }
    }
  }
  weightedScoreSum += relevanceScore * 0.25;
  totalActiveWeight += 0.25;

  // 3. Availability Score (Weight: 20)
  let availabilityScore = 15;
  switch (factors.availabilityType) {
    case 'today':
      availabilityScore = 100;
      break;
    case 'tomorrow':
      availabilityScore = 80;
      break;
    case 'week':
      availabilityScore = 50;
      break;
    case 'none':
    default:
      availabilityScore = 15;
      break;
  }
  weightedScoreSum += availabilityScore * 0.20;
  totalActiveWeight += 0.20;

  // 4. Experience Score (Weight: 15)
  let experienceScore: number | null = null;
  if (typeof factors.experienceYears === 'number' && factors.experienceYears >= 0) {
    // 0 years = 40, 10 years = 80, 15+ years = 100
    experienceScore = Math.min(100, Math.round(40 + (factors.experienceYears / 15) * 60));
    weightedScoreSum += experienceScore * 0.15;
    totalActiveWeight += 0.15;
  }

  // 5. Rating Score (Weight: 10)
  let ratingScore: number | null = null;
  if (typeof factors.rating === 'number' && factors.rating > 0) {
    // 5.0 = 100, 4.0 = 80, 3.0 = 60
    ratingScore = Math.min(100, Math.round((factors.rating / 5.0) * 100));
    weightedScoreSum += ratingScore * 0.10;
    totalActiveWeight += 0.10;
  }

  // Normalize final score to 0 - 100 based on active criteria
  const normalizedScore = totalActiveWeight > 0
    ? Number((weightedScoreSum / totalActiveWeight).toFixed(1))
    : 70;

  const matchPercentage = Math.round(normalizedScore);

  let scoreLabel = 'Recommended';
  if (matchPercentage >= 85) {
    scoreLabel = 'Highly Recommended';
  } else if (matchPercentage >= 70) {
    scoreLabel = 'Recommended';
  } else if (matchPercentage >= 55) {
    scoreLabel = 'Good Match';
  } else {
    scoreLabel = 'Available Doctor';
  }

  return {
    score: normalizedScore,
    scoreLabel,
    matchPercentage,
    breakdown: {
      distance: distanceScore,
      relevance: relevanceScore,
      availability: availabilityScore,
      experience: experienceScore,
      rating: ratingScore,
    },
  };
}
