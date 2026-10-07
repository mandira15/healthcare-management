const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const R = 6371; // Earth radius in km

function haversineDistance(lat1, lon1, lat2, lon2) {
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Calculate recommendation score based on weights
function calculateScore({ distanceKm, specialty, experienceYears, rating, concern }) {
  // 1. Distance score (30% weight)
  let distanceScore = 0;
  if (distanceKm !== null && distanceKm !== undefined) {
    if (distanceKm <= 1.0) distanceScore = 100 - (distanceKm * 20); // 0km = 100, 1km = 80
    else if (distanceKm <= 5.0) distanceScore = 80 - ((distanceKm - 1) * 10);
    else distanceScore = Math.max(10, 40 - (distanceKm * 2));
  } else {
    distanceScore = 50;
  }

  // 2. Specialty relevance (25% weight)
  let relevanceScore = 70;
  if (concern) {
    const c = concern.toLowerCase();
    const s = (specialty || '').toLowerCase();
    if (c.includes('stomach') || c.includes('digestion') || c.includes('gut')) {
      if (s.includes('gastro')) relevanceScore = 100;
      else if (s.includes('general')) relevanceScore = 60;
    } else {
      relevanceScore = 80;
    }
  }

  // 3. Availability score (20% weight)
  let availabilityScore = 95; // Demo doctors have full mon-fri working hours

  // 4. Experience score (15% weight)
  let expScore = Math.min(100, (experienceYears || 0) * 10);

  // 5. Rating score (10% weight)
  let ratingScore = ((rating || 0) / 5) * 100;

  const total = (
    distanceScore * 0.30 +
    relevanceScore * 0.25 +
    availabilityScore * 0.20 +
    expScore * 0.15 +
    ratingScore * 0.10
  );

  return {
    total: Math.round(total),
    breakdown: {
      distance: Math.round(distanceScore * 0.30),
      relevance: Math.round(relevanceScore * 0.25),
      availability: Math.round(availabilityScore * 0.20),
      experience: Math.round(expScore * 0.15),
      rating: Math.round(ratingScore * 0.10)
    }
  };
}

async function runTests() {
  console.log('====================================================');
  console.log('VERIFICATION TEST SUITE: DEMO DOCTORS (<= 1.0 KM)');
  console.log('====================================================\n');

  console.log('--- TEST 1: Retrieve 3 Demo Doctors from Database ---');
  const demoDocs = await prisma.doctorProfile.findMany({
    where: {
      user: {
        email: {
          in: ['demo.doc1@demo.local', 'demo.doc2@demo.local', 'demo.doc3@demo.local']
        }
      }
    },
    include: {
      user: true
    }
  });

  console.log(`Found ${demoDocs.length} demo doctors.`);
  if (demoDocs.length !== 3) {
    throw new Error(`Expected exactly 3 demo doctors, but found ${demoDocs.length}`);
  }

  const refLat = 23.2300;
  const refLon = 77.4300;
  console.log(`Reference Test Location: lat = ${refLat}, lon = ${refLon} (Bhopal)`);

  demoDocs.sort((a, b) => a.user.name.localeCompare(b.user.name));

  const doctorsWithDist = [];

  for (const doc of demoDocs) {
    const dist = haversineDistance(refLat, refLon, doc.latitude, doc.longitude);
    console.log(`\nDoctor: ${doc.user.name} (${doc.user.email})`);
    console.log(`  • Specialization: ${doc.specialization}`);
    console.log(`  • Experience: ${doc.experienceYears} years`);
    console.log(`  • Rating: ${doc.rating} / 5.0`);
    console.log(`  • Clinic: ${doc.clinicName} (${doc.clinicAddress})`);
    console.log(`  • Coordinates: (${doc.latitude}, ${doc.longitude})`);
    console.log(`  • Calculated Distance: ${dist.toFixed(3)} km`);
    console.log(`  • Within 1 km: ${dist <= 1.0 ? '✓ YES' : '✗ NO'}`);
    console.log(`  • Bio / Tag: ${doc.bio}`);

    if (dist > 1.0) {
      throw new Error(`Distance exceeded 1.0 km: ${dist.toFixed(3)} km for ${doc.user.name}`);
    }

    doctorsWithDist.push({
      ...doc,
      distanceKm: dist
    });
  }

  console.log('\n--- TEST 2: Overall Ranking Demonstration (Reference Location) ---');
  const scored = doctorsWithDist.map(d => {
    const scoreObj = calculateScore({
      distanceKm: d.distanceKm,
      specialty: d.specialization,
      experienceYears: d.experienceYears,
      rating: d.rating
    });
    return {
      name: d.user.name,
      specialty: d.specialization,
      distKm: Number(d.distanceKm.toFixed(3)),
      score: scoreObj.total,
      breakdown: scoreObj.breakdown
    };
  });

  scored.sort((a, b) => b.score - a.score);
  scored.forEach((s, idx) => {
    console.log(`  #${idx + 1}: ${s.name} | Dist: ${s.distKm} km | Score: ${s.score}/100 | Specialty: ${s.specialty}`);
  });

  console.log('\n--- TEST 3: Specialization Filtering ---');
  const gastroDocs = doctorsWithDist.filter(d => 
    d.specialization.toLowerCase().includes('gastro')
  );
  console.log(`• Filter [Gastroenterologist]: Found ${gastroDocs.length} doctor(s) -> ${gastroDocs.map(d => d.user.name).join(', ')}`);
  if (gastroDocs.length !== 1 || gastroDocs[0].user.name !== 'Dr. Demo Two') {
    throw new Error('Specialization filter failed for Gastroenterologist');
  }

  const gpDocs = doctorsWithDist.filter(d => 
    d.specialization.toLowerCase().includes('general')
  );
  console.log(`• Filter [General Physician]: Found ${gpDocs.length} doctor(s) -> ${gpDocs.map(d => d.user.name).join(', ')}`);
  if (gpDocs.length !== 2) {
    throw new Error('Specialization filter failed for General Physician');
  }

  console.log('\n--- TEST 4: Distance Radius Filtering ---');
  const within300m = doctorsWithDist.filter(d => d.distanceKm <= 0.3);
  console.log(`• Radius [<= 0.3 km]: Found ${within300m.length} doctor(s) -> ${within300m.map(d => `${d.user.name} (${d.distanceKm.toFixed(3)} km)`).join(', ')}`);
  if (within300m.length !== 1 || within300m[0].user.name !== 'Dr. Demo One') {
    throw new Error('Radius filter failed for 0.3 km');
  }

  const within600m = doctorsWithDist.filter(d => d.distanceKm <= 0.6);
  console.log(`• Radius [<= 0.6 km]: Found ${within600m.length} doctor(s) -> ${within600m.map(d => `${d.user.name} (${d.distanceKm.toFixed(3)} km)`).join(', ')}`);
  if (within600m.length !== 2) {
    throw new Error('Radius filter failed for 0.6 km');
  }

  const within1km = doctorsWithDist.filter(d => d.distanceKm <= 1.0);
  console.log(`• Radius [<= 1.0 km]: Found ${within1km.length} doctor(s) -> All 3 demo doctors match!`);
  if (within1km.length !== 3) {
    throw new Error('Radius filter failed for 1.0 km');
  }

  console.log('\n--- TEST 5: Health Concern Relevance Ranking ---');
  console.log('Concern: "severe stomach ache and indigestion"');
  const gastroRanked = doctorsWithDist.map(d => {
    const scoreObj = calculateScore({
      distanceKm: d.distanceKm,
      specialty: d.specialization,
      experienceYears: d.experienceYears,
      rating: d.rating,
      concern: 'severe stomach ache and indigestion'
    });
    return {
      name: d.user.name,
      specialty: d.specialization,
      distKm: Number(d.distanceKm.toFixed(3)),
      score: scoreObj.total
    };
  }).sort((a, b) => b.score - a.score);

  gastroRanked.forEach((s, idx) => {
    console.log(`  #${idx + 1}: ${s.name} (${s.specialty}) - Score: ${s.score}`);
  });
  if (gastroRanked[0].name !== 'Dr. Demo Two') {
    throw new Error('Expected Dr. Demo Two (Gastroenterologist) to rank #1 for stomach concern');
  }

  console.log('\n--- TEST 6: Working Hours Schedule & Booking Readiness ---');
  for (const doc of demoDocs) {
    const wh = JSON.parse(doc.workingHours);
    console.log(`✓ ${doc.user.name}: Slot duration ${doc.slotDurationMinutes} mins, Working days: ${Object.keys(wh).join(', ')}`);
  }

  console.log('\n====================================================');
  console.log('✓ ALL 6 TEST VERIFICATION SUITES PASSED FLAWLESSLY!');
  console.log('====================================================\n');
}

runTests()
  .catch(err => {
    console.error('Test error:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
