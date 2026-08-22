// prisma/seed.ts
// Run with: npm run db:seed
// Creates a default admin account and a sample doctor.
// Change the passwords before running in production!

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Admin
  const adminHash = await bcrypt.hash('admin123456', 12);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@healthcare.local' },
    update: {},
    create: {
      email: 'admin@healthcare.local',
      passwordHash: adminHash,
      name: 'System Admin',
      role: 'ADMIN',
    },
  });
  console.log('✓ Admin created:', admin.email);

  // Sample doctor
  const doctorHash = await bcrypt.hash('doctor123456', 12);
  const doctor = await prisma.user.upsert({
    where: { email: 'dr.smith@healthcare.local' },
    update: {},
    create: {
      email: 'dr.smith@healthcare.local',
      passwordHash: doctorHash,
      name: 'Jane Smith',
      role: 'DOCTOR',
      doctorProfile: {
        create: {
          specialization: 'General Practice',
          slotDurationMinutes: 30,
          workingHours: JSON.stringify({
            mon: { start: '09:00', end: '17:00' },
            tue: { start: '09:00', end: '17:00' },
            wed: { start: '09:00', end: '13:00' },
            thu: { start: '09:00', end: '17:00' },
            fri: { start: '09:00', end: '17:00' },
          }),
          leaveDates: '[]',
          bio: 'Experienced general practitioner with 10+ years of practice.',
          clinicName: 'HealthCare Clinic',
        },
      },
    },
  });
  console.log('✓ Doctor created:', doctor.email);

  // Sample patient
  const patientHash = await bcrypt.hash('patient123456', 12);
  const patient = await prisma.user.upsert({
    where: { email: 'patient@healthcare.local' },
    update: {},
    create: {
      email: 'patient@healthcare.local',
      passwordHash: patientHash,
      name: 'John Doe',
      role: 'PATIENT',
    },
  });
  console.log('✓ Patient created:', patient.email);

  console.log('\n✅ Seed complete!');
  console.log('\nDefault accounts:');
  console.log('  Admin:   admin@healthcare.local / admin123456');
  console.log('  Doctor:  dr.smith@healthcare.local / doctor123456');
  console.log('  Patient: patient@healthcare.local / patient123456');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
