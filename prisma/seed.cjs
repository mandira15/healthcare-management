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
          bio: 'Experienced general practitioner.',
          clinicName: 'HealthCare Clinic',
        },
      },
    },
  });
  console.log('✓ Doctor:  dr.smith@demo.local / doctor123456');

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
