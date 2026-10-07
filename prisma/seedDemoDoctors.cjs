/**
 * seedDemoDoctors.cjs
 * Creates or updates exactly 3 fake/demo doctors located within 1 km
 * of the reference test location (lat: 23.2300, lon: 77.4300 in Bhopal).
 *
 * Distances from test location:
 * - Dr. Demo One: ~0.186 km (~0.2 km)
 * - Dr. Demo Two: ~0.492 km (~0.5 km)
 * - Dr. Demo Three: ~0.810 km (~0.8 km)
 *
 * Idempotent: checks for existing records by email and upserts cleanly.
 */

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

const DEMO_DOCTORS = [
  {
    email: 'demo.doc1@demo.local',
    name: 'Dr. Demo One',
    specialization: 'General Physician',
    experienceYears: 8,
    rating: 4.8,
    clinicName: 'Demo Health Clinic',
    clinicAddress: 'Demo Suite 101, MP Nagar Zone I',
    address: 'MP Nagar Zone I',
    city: 'Bhopal',
    state: 'Madhya Pradesh',
    postalCode: '462011',
    phone: '+91 99999 00001',
    latitude: 23.2314, // ~0.186 km from (23.2300, 77.4300)
    longitude: 77.4310,
    slotDurationMinutes: 30,
    workingHours: JSON.stringify({
      mon: { start: '09:00', end: '17:00' },
      tue: { start: '09:00', end: '17:00' },
      wed: { start: '09:00', end: '17:00' },
      thu: { start: '09:00', end: '17:00' },
      fri: { start: '09:00', end: '17:00' },
    }),
    bio: '[DEMO RECORD] Demo General Physician created for development and recommendation testing only.',
  },
  {
    email: 'demo.doc2@demo.local',
    name: 'Dr. Demo Two',
    specialization: 'Gastroenterologist',
    experienceYears: 10,
    rating: 4.7,
    clinicName: 'Demo Gastro Care',
    clinicAddress: 'Demo Suite 202, MP Nagar Zone II',
    address: 'MP Nagar Zone II',
    city: 'Bhopal',
    state: 'Madhya Pradesh',
    postalCode: '462011',
    phone: '+91 99999 00002',
    latitude: 23.2336, // ~0.492 km from (23.2300, 77.4300)
    longitude: 77.4328,
    slotDurationMinutes: 30,
    workingHours: JSON.stringify({
      mon: { start: '10:00', end: '18:00' },
      tue: { start: '10:00', end: '18:00' },
      wed: { start: '10:00', end: '18:00' },
      thu: { start: '10:00', end: '18:00' },
      fri: { start: '10:00', end: '18:00' },
    }),
    bio: '[DEMO RECORD] Demo Gastroenterologist created for development and recommendation testing only.',
  },
  {
    email: 'demo.doc3@demo.local',
    name: 'Dr. Demo Three',
    specialization: 'General Physician',
    experienceYears: 5,
    rating: 4.5,
    clinicName: 'Demo Medical Center',
    clinicAddress: 'Demo Suite 303, Arera Hills',
    address: 'Arera Hills',
    city: 'Bhopal',
    state: 'Madhya Pradesh',
    postalCode: '462011',
    phone: '+91 99999 00003',
    latitude: 23.2358, // ~0.810 km from (23.2300, 77.4300)
    longitude: 77.4348,
    slotDurationMinutes: 30,
    workingHours: JSON.stringify({
      mon: { start: '09:00', end: '17:00' },
      tue: { start: '09:00', end: '17:00' },
      wed: { start: '09:00', end: '17:00' },
      thu: { start: '09:00', end: '17:00' },
      fri: { start: '09:00', end: '17:00' },
    }),
    bio: '[DEMO RECORD] Demo General Physician created for development and recommendation testing only.',
  },
];

async function seedDemoDoctors() {
  console.log('--- Seeding exactly 3 Demo Doctors ---');
  const passwordHash = await bcrypt.hash('doctor123456', 12);

  for (const doc of DEMO_DOCTORS) {
    const existing = await prisma.user.findUnique({
      where: { email: doc.email },
      include: { doctorProfile: true },
    });

    if (existing) {
      console.log(`Updating existing demo doctor: ${doc.name} (${doc.email})`);
      await prisma.user.update({
        where: { id: existing.id },
        data: { name: doc.name },
      });

      if (existing.doctorProfile) {
        await prisma.doctorProfile.update({
          where: { id: existing.doctorProfile.id },
          data: {
            specialization: doc.specialization,
            experienceYears: doc.experienceYears,
            rating: doc.rating,
            clinicName: doc.clinicName,
            clinicAddress: doc.clinicAddress,
            address: doc.address,
            city: doc.city,
            state: doc.state,
            postalCode: doc.postalCode,
            phone: doc.phone,
            latitude: doc.latitude,
            longitude: doc.longitude,
            slotDurationMinutes: doc.slotDurationMinutes,
            workingHours: doc.workingHours,
            bio: doc.bio,
          },
        });
      } else {
        await prisma.doctorProfile.create({
          data: {
            userId: existing.id,
            specialization: doc.specialization,
            experienceYears: doc.experienceYears,
            rating: doc.rating,
            clinicName: doc.clinicName,
            clinicAddress: doc.clinicAddress,
            address: doc.address,
            city: doc.city,
            state: doc.state,
            postalCode: doc.postalCode,
            phone: doc.phone,
            latitude: doc.latitude,
            longitude: doc.longitude,
            slotDurationMinutes: doc.slotDurationMinutes,
            workingHours: doc.workingHours,
            leaveDates: '[]',
            bio: doc.bio,
          },
        });
      }
    } else {
      console.log(`Creating new demo doctor: ${doc.name} (${doc.email})`);
      await prisma.user.create({
        data: {
          email: doc.email,
          passwordHash,
          name: doc.name,
          role: 'DOCTOR',
          doctorProfile: {
            create: {
              specialization: doc.specialization,
              experienceYears: doc.experienceYears,
              rating: doc.rating,
              clinicName: doc.clinicName,
              clinicAddress: doc.clinicAddress,
              address: doc.address,
              city: doc.city,
              state: doc.state,
              postalCode: doc.postalCode,
              phone: doc.phone,
              latitude: doc.latitude,
              longitude: doc.longitude,
              slotDurationMinutes: doc.slotDurationMinutes,
              workingHours: doc.workingHours,
              leaveDates: '[]',
              bio: doc.bio,
            },
          },
        },
      });
    }
  }

  console.log('✓ Successfully seeded all 3 demo doctors.');
}

seedDemoDoctors()
  .catch((err) => {
    console.error('Seed error:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
