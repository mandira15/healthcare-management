const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function seed() {
  // ADMIN
  const adminHash = await bcrypt.hash('admin123456', 12);
  await prisma.user.upsert({
    where: { email: 'admin@demo.local' },
    update: {},
    create: {
      email: 'admin@demo.local',
      passwordHash: adminHash,
      name: 'System Admin',
      role: 'ADMIN',
    },
  });
  console.log('✓ Admin:   admin@demo.local / admin123456');

  // DOCTOR
  const doctorHash = await bcrypt.hash('doctor123456', 12);
  await prisma.user.upsert({
    where: { email: 'dr.smith@demo.local' },
    update: {},
    create: {
      email: 'dr.smith@demo.local',
      passwordHash: doctorHash,
      name: 'Dr. Jane Smith',
      role: 'DOCTOR',
      doctorProfile: {
        create: {
          specialization: 'General Practice',
          slotDurationMinutes: 30,
          workingHours: JSON.stringify({
            mon: { start: '09:00', end: '17:00' },
            tue: { start: '09:00', end: '17:00' },
            wed: { start: '09:00', end: '17:00' },
            thu: { start: '09:00', end: '17:00' },
            fri: { start: '09:00', end: '17:00' },
          }),
          leaveDates: '[]',
          bio: 'Experienced general practitioner with 10+ years of clinical care.',
          clinicName: 'City Central Health Clinic',
          clinicAddress: '42 Arera Hills, Near Link Road 1',
          address: '42 Arera Hills',
          city: 'Bhopal',
          state: 'Madhya Pradesh',
          postalCode: '462011',
          latitude: 23.2332,
          longitude: 77.4343,
          phone: '+91 98765 43210',
        },
      },
    },
  });
  console.log('✓ Doctor:  dr.smith@demo.local / doctor123456');

  // Additional sample doctor with cardiology specialization and coordinates
  const cardioHash = await bcrypt.hash('doctor123456', 12);
  await prisma.user.upsert({
    where: { email: 'dr.sharma@demo.local' },
    update: {},
    create: {
      email: 'dr.sharma@demo.local',
      passwordHash: cardioHash,
      name: 'Dr. Rajesh Sharma',
      role: 'DOCTOR',
      doctorProfile: {
        create: {
          specialization: 'Cardiology',
          slotDurationMinutes: 30,
          workingHours: JSON.stringify({
            mon: { start: '10:00', end: '18:00' },
            tue: { start: '10:00', end: '18:00' },
            wed: { start: '10:00', end: '18:00' },
            thu: { start: '10:00', end: '18:00' },
            fri: { start: '10:00', end: '16:00' },
          }),
          leaveDates: '[]',
          bio: 'Senior consultant cardiologist specializing in preventive cardiology and heart health.',
          clinicName: 'Heart & Vascular Care Center',
          clinicAddress: '15 MP Nagar Zone II',
          address: '15 MP Nagar Zone II',
          city: 'Bhopal',
          state: 'Madhya Pradesh',
          postalCode: '462011',
          latitude: 23.2315,
          longitude: 77.4320,
          phone: '+91 98765 12345',
        },
      },
    },
  });
  console.log('✓ Doctor:  dr.sharma@demo.local / doctor123456 (Cardiology)');

  // Additional sample doctor (Dermatology)
  const dermHash = await bcrypt.hash('doctor123456', 12);
  await prisma.user.upsert({
    where: { email: 'dr.patel@demo.local' },
    update: {},
    create: {
      email: 'dr.patel@demo.local',
      passwordHash: dermHash,
      name: 'Dr. Ananya Patel',
      role: 'DOCTOR',
      doctorProfile: {
        create: {
          specialization: 'Dermatology',
          slotDurationMinutes: 20,
          workingHours: JSON.stringify({
            mon: { start: '09:00', end: '15:00' },
            wed: { start: '09:00', end: '15:00' },
            fri: { start: '09:00', end: '15:00' },
            sat: { start: '10:00', end: '14:00' },
          }),
          leaveDates: '[]',
          bio: 'Dermatologist and aesthetic specialist focused on clinical dermatology and skin care.',
          clinicName: 'Skin Essentials Clinic',
          clinicAddress: '88 Kolar Road, Chuna Bhatti',
          address: '88 Kolar Road',
          city: 'Bhopal',
          state: 'Madhya Pradesh',
          postalCode: '462016',
          latitude: 23.2010,
          longitude: 77.4190,
          phone: '+91 98765 67890',
        },
      },
    },
  });
  console.log('✓ Doctor:  dr.patel@demo.local / doctor123456 (Dermatology)');

  // PATIENT
  const patientHash = await bcrypt.hash('patient123456', 12);
  await prisma.user.upsert({
    where: { email: 'patient@demo.local' },
    update: {},
    create: {
      email: 'patient@demo.local',
      passwordHash: patientHash,
      name: 'John Doe',
      role: 'PATIENT',
    },
  });
  console.log('✓ Patient: patient@demo.local / patient123456');

  await prisma.$disconnect();
  console.log('\nDatabase seeded successfully!');
}

seed().catch((e) => {
  console.error(e);
  process.exit(1);
});
