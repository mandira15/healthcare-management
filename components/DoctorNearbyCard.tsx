'use client';

import React from 'react';
import Link from 'next/link';
import { formatDistance } from '@/lib/distance';

export interface NearbyDoctor {
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
  distanceKm: number | null;
  availability: {
    type: 'today' | 'tomorrow' | 'week' | 'none';
    label: string;
    badgeClass: string;
  };
}

interface DoctorNearbyCardProps {
  doctor: NearbyDoctor;
  onViewDetails?: (doctor: NearbyDoctor) => void;
}

export default function DoctorNearbyCard({
  doctor,
  onViewDetails,
}: DoctorNearbyCardProps) {
  const fullAddress = [
    doctor.clinicAddress || doctor.address,
    doctor.city,
    doctor.state,
  ]
    .filter(Boolean)
    .join(', ');

  return (
    <div className="card hover:shadow-md transition-all duration-200 border border-gray-100 flex flex-col justify-between h-full bg-white">
      <div>
        {/* Header: Name, Specialty & Distance */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-primary-100 text-primary-700 flex items-center justify-center font-bold text-lg shrink-0">
              {doctor.name.replace(/^Dr\.\s*/i, '').charAt(0) || 'D'}
            </div>
            <div>
              <h3 className="font-bold text-gray-900 text-base leading-tight">
                {doctor.name.startsWith('Dr.') ? doctor.name : `Dr. ${doctor.name}`}
              </h3>
              <p className="text-sm font-medium text-primary-600">
                {doctor.specialization}
              </p>
            </div>
          </div>

          {doctor.distanceKm !== null && (
            <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-primary-50 text-primary-700 border border-primary-200 shrink-0">
              <svg
                className="w-3.5 h-3.5 text-primary-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
              {formatDistance(doctor.distanceKm)}
            </span>
          )}
        </div>

        {/* Availability Badge */}
        <div className="mt-2 mb-3">
          <span
            className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-0.5 rounded-full border ${doctor.availability.badgeClass}`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                doctor.availability.type === 'today'
                  ? 'bg-emerald-500'
                  : doctor.availability.type === 'tomorrow'
                  ? 'bg-amber-500'
                  : doctor.availability.type === 'week'
                  ? 'bg-blue-500'
                  : 'bg-gray-400'
              }`}
            />
            {doctor.availability.label}
          </span>
        </div>

        {/* Clinic & Address */}
        <div className="text-xs text-gray-500 space-y-1 mb-4">
          {doctor.clinicName && (
            <p className="font-medium text-gray-700 flex items-center gap-1.5">
              <svg
                className="w-3.5 h-3.5 text-gray-400 shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                />
              </svg>
              {doctor.clinicName}
            </p>
          )}
          {fullAddress && (
            <p className="flex items-center gap-1.5 text-gray-500">
              <svg
                className="w-3.5 h-3.5 text-gray-400 shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                />
              </svg>
              <span className="truncate">{fullAddress}</span>
            </p>
          )}
          {doctor.bio && (
            <p className="text-gray-600 line-clamp-2 mt-2 italic text-[11px] leading-relaxed">
              &ldquo;{doctor.bio}&rdquo;
            </p>
          )}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="pt-3 border-t border-gray-100 flex items-center gap-2 mt-2">
        {onViewDetails && (
          <button
            type="button"
            onClick={() => onViewDetails(doctor)}
            className="btn-secondary text-xs py-2 px-3 flex-1 text-center"
          >
            View Profile
          </button>
        )}
        <Link
          href={`/patient/book?doctorId=${doctor.id}`}
          className="btn-primary text-xs py-2 px-3 flex-1 text-center flex items-center justify-center gap-1"
        >
          Book Appointment
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
          </svg>
        </Link>
      </div>
    </div>
  );
}
