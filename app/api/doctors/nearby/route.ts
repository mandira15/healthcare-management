import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { getSessionUser } from '@/lib/auth';
import { calculateDistance } from '@/lib/distance';
import { getDoctorsAvailabilityBatch } from '@/lib/doctorAvailability';
import { calculateDoctorRecommendationScore, matchesDoctorSearch } from '@/lib/doctorRanking';

export const dynamic = 'force-dynamic';

const NearbyQuerySchema = z.object({
  latitude: z.coerce.number().min(-90).max(90).optional(),
  longitude: z.coerce.number().min(-180).max(180).optional(),
  radius: z.coerce.number().min(0.5).max(500).optional().default(10),
  specialty: z.string().optional(),
  search: z.string().optional(),
  city: z.string().optional(),
  availability: z.enum(['all', 'today', 'week']).optional().default('all'),
  sortBy: z.enum(['recommended', 'distance', 'availability', 'experience', 'name']).optional().default('recommended'),
});

export async function GET(req: NextRequest) {
  try {
    const session = await getSessionUser();
    if (!session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { searchParams } = req.nextUrl;
    const rawParams = Object.fromEntries(searchParams.entries());
    const parsed = NearbyQuerySchema.safeParse(rawParams);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const {
      latitude: userLat,
      longitude: userLng,
      radius: radiusKm,
      specialty,
      search,
      city,
      availability: availFilter,
      sortBy,
    } = parsed.data;

    // Has valid coordinates for distance calculation
    const hasCoordinates = typeof userLat === 'number' && typeof userLng === 'number';

    // Fetch doctors with profile
    const doctors = await prisma.user.findMany({
      where: {
        role: 'DOCTOR',
        doctorProfile: {
          isNot: null,
          is: {
            ...(specialty ? { specialization: { contains: specialty } } : {}),
            ...(city ? { city: { contains: city } } : {}),
          },
        },
      },
      select: {
        id: true,
        name: true,
        email: true,
        doctorProfile: {
          select: {
            id: true,
            specialization: true,
            clinicName: true,
            clinicAddress: true,
            address: true,
            city: true,
            state: true,
            postalCode: true,
            latitude: true,
            longitude: true,
            bio: true,
            phone: true,
            experienceYears: true,
            rating: true,
            slotDurationMinutes: true,
            workingHours: true,
            leaveDates: true,
          },
        },
      },
    });

    // Extract doctor profiles map for availability batch computation
    const doctorProfilesMap = new Map();
    for (const doc of doctors) {
      if (doc.doctorProfile) {
        doctorProfilesMap.set(doc.id, {
          workingHours: doc.doctorProfile.workingHours,
          leaveDates: doc.doctorProfile.leaveDates,
          slotDurationMinutes: doc.doctorProfile.slotDurationMinutes,
        });
      }
    }

    // Batch calculate availability
    const availabilityMap = await getDoctorsAvailabilityBatch(
      doctors.map((d) => d.id),
      doctorProfilesMap
    );

    // Compute distance, score and filter
    type ProcessedDoctor = {
      id: string;
      name: string;
      email: string;
      specialization: string;
      clinicName: string | null;
      clinicAddress: string | null;
      address: string | null;
      city: string | null;
      state: string | null;
      postalCode: string | null;
      latitude: number | null;
      longitude: number | null;
      bio: string | null;
      phone: string | null;
      experienceYears: number | null;
      rating: number | null;
      distanceKm: number | null;
      availability: {
        type: 'today' | 'tomorrow' | 'week' | 'none';
        label: string;
        badgeClass: string;
      };
      score: number;
      scoreLabel: string;
      matchPercentage: number;
      scoreBreakdown: {
        distance: number | null;
        relevance: number;
        availability: number;
        experience: number | null;
        rating: number | null;
      };
    };

    let processed: ProcessedDoctor[] = [];

    for (const doc of doctors) {
      const profile = doc.doctorProfile;
      if (!profile) continue;

      let distanceKm: number | null = null;
      if (hasCoordinates) {
        // Must have doctor coordinates to calculate distance
        if (typeof profile.latitude !== 'number' || typeof profile.longitude !== 'number') {
          // If searching by coordinates and filtering by radius, doctors without coordinates cannot be matched by radius
          continue;
        }

        distanceKm = calculateDistance(
          userLat!,
          userLng!,
          profile.latitude,
          profile.longitude
        );

        if (distanceKm > radiusKm) {
          // Outside radius
          continue;
        }
      }

      const availability = availabilityMap.get(doc.id) || {
        type: 'none' as const,
        label: 'No Available Slots',
        badgeClass: 'bg-gray-100 text-gray-600 border-gray-200',
      };

      // Availability filter
      if (availFilter === 'today' && availability.type !== 'today') {
        continue;
      }
      if (
        availFilter === 'week' &&
        availability.type !== 'today' &&
        availability.type !== 'tomorrow' &&
        availability.type !== 'week'
      ) {
        continue;
      }

      // Search across doctor name, specialization, clinic, address, city, bio, and health concerns
      if (search && search.trim()) {
        const matches = matchesDoctorSearch(search, {
          name: doc.name,
          specialization: profile.specialization,
          clinicName: profile.clinicName,
          city: profile.city,
          address: profile.address,
          bio: profile.bio,
        });

        if (!matches) {
          continue;
        }
      }

      // Calculate transparent recommendation score
      const rec = calculateDoctorRecommendationScore({
        distanceKm,
        maxRadiusKm: radiusKm,
        specialization: profile.specialization,
        searchConcern: search,
        selectedSpecialty: specialty,
        availabilityType: availability.type,
        experienceYears: profile.experienceYears,
        rating: profile.rating,
      });

      processed.push({
        id: doc.id,
        name: doc.name,
        email: doc.email,
        specialization: profile.specialization,
        clinicName: profile.clinicName,
        clinicAddress: profile.clinicAddress,
        address: profile.address,
        city: profile.city,
        state: profile.state,
        postalCode: profile.postalCode,
        latitude: profile.latitude,
        longitude: profile.longitude,
        bio: profile.bio,
        phone: profile.phone,
        experienceYears: profile.experienceYears,
        rating: profile.rating,
        distanceKm: distanceKm !== null ? Number(distanceKm.toFixed(2)) : null,
        availability,
        score: rec.score,
        scoreLabel: rec.scoreLabel,
        matchPercentage: rec.matchPercentage,
        scoreBreakdown: rec.breakdown,
      });
    }

    // Sort options
    if (sortBy === 'distance' && hasCoordinates) {
      processed.sort((a, b) => (a.distanceKm ?? 999999) - (b.distanceKm ?? 999999));
    } else if (sortBy === 'availability') {
      const rank: Record<string, number> = { today: 1, tomorrow: 2, week: 3, none: 4 };
      processed.sort((a, b) => rank[a.availability.type] - rank[b.availability.type]);
    } else if (sortBy === 'experience') {
      processed.sort((a, b) => (b.experienceYears ?? 0) - (a.experienceYears ?? 0));
    } else if (sortBy === 'name') {
      processed.sort((a, b) => a.name.localeCompare(b.name));
    } else {
      // Default: 'recommended' sort by recommendation score
      processed.sort((a, b) => b.score - a.score);
    }

    // Extract available specialties list for filter dropdown
    const allSpecialties = Array.from(
      new Set(
        doctors
          .map((d) => d.doctorProfile?.specialization)
          .filter((s): s is string => Boolean(s && s.trim()))
      )
    ).sort();

    return NextResponse.json({
      success: true,
      doctors: processed,
      totalCount: processed.length,
      radiusKm: hasCoordinates ? radiusKm : null,
      userCoordinates: hasCoordinates ? { latitude: userLat, longitude: userLng } : null,
      availableSpecialties: allSpecialties,
    });
  } catch (err) {
    console.error('[Nearby Doctors] GET error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
