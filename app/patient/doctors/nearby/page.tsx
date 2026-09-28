'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import DoctorNearbyCard, { NearbyDoctor } from '@/components/DoctorNearbyCard';
import { formatDistance } from '@/lib/distance';

// Dynamically import Leaflet map with ssr: false
const NearbyDoctorsMap = dynamic(() => import('@/components/NearbyDoctorsMap'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[450px] rounded-xl bg-gray-100 flex flex-col items-center justify-center text-gray-400 gap-2 border border-gray-200 animate-pulse">
      <svg className="w-8 h-8 animate-spin text-primary-500" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
      </svg>
      <span className="text-sm">Loading map view...</span>
    </div>
  ),
});

type GeolocationStatus =
  | 'idle'
  | 'requesting'
  | 'granted'
  | 'denied'
  | 'unavailable'
  | 'timeout'
  | 'unsupported';

export default function FindNearbyDoctorsPage() {
  const [doctors, setDoctors] = useState<NearbyDoctor[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // User location state (in-memory only)
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [geoStatus, setGeoStatus] = useState<GeolocationStatus>('idle');

  // Filters & Search
  const [radiusKm, setRadiusKm] = useState<number>(10);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSpecialty, setSelectedSpecialty] = useState('');
  const [availabilityFilter, setAvailabilityFilter] = useState<'all' | 'today' | 'week'>('all');
  const [sortBy, setSortBy] = useState<'distance' | 'availability' | 'name'>('distance');
  const [cityInput, setCityInput] = useState('');

  // Dropdown options
  const [availableSpecialties, setAvailableSpecialties] = useState<string[]>([]);

  // View mode
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');

  // Selected doctor modal state
  const [selectedDoctor, setSelectedDoctor] = useState<NearbyDoctor | null>(null);

  // Fetch doctors
  const fetchDoctors = useCallback(
    async (coords?: { latitude: number; longitude: number } | null) => {
      setLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams();

        if (coords) {
          params.set('latitude', coords.latitude.toString());
          params.set('longitude', coords.longitude.toString());
          params.set('radius', radiusKm.toString());
        }

        if (searchQuery.trim()) {
          params.set('search', searchQuery.trim());
        }

        if (selectedSpecialty) {
          params.set('specialty', selectedSpecialty);
        }

        if (cityInput.trim()) {
          params.set('city', cityInput.trim());
        }

        if (availabilityFilter !== 'all') {
          params.set('availability', availabilityFilter);
        }

        params.set('sortBy', sortBy);

        const res = await fetch(`/api/doctors/nearby?${params.toString()}`);
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || 'Failed to fetch doctors');
        }

        const data = await res.json();
        setDoctors(data.doctors || []);
        if (data.availableSpecialties && data.availableSpecialties.length > 0) {
          setAvailableSpecialties(data.availableSpecialties);
        }
      } catch (err: any) {
        console.error('[Nearby Doctors UI] Fetch error:', err);
        setError('Unable to load nearby doctors. Please try again.');
      } finally {
        setLoading(false);
      }
    },
    [radiusKm, searchQuery, selectedSpecialty, cityInput, availabilityFilter, sortBy]
  );

  // Geolocation trigger
  const requestLocation = () => {
    if (typeof window === 'undefined' || !navigator.geolocation) {
      setGeoStatus('unsupported');
      return;
    }

    setGeoStatus('requesting');
    setError(null);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        };
        setUserLocation(coords);
        setGeoStatus('granted');
        fetchDoctors(coords);
      },
      (err) => {
        console.warn('[Geolocation Error]:', err.code, err.message);
        if (err.code === err.PERMISSION_DENIED) {
          setGeoStatus('denied');
        } else if (err.code === err.TIMEOUT) {
          setGeoStatus('timeout');
        } else {
          setGeoStatus('unavailable');
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000,
      }
    );
  };

  // Initial load: fetch general doctor list without coordinates first so user sees options immediately
  useEffect(() => {
    fetchDoctors(userLocation);
  }, [fetchDoctors, userLocation]);

  return (
    <div className="min-h-screen bg-gray-50 pb-16">
      {/* Navigation */}
      <nav className="bg-white border-b border-gray-200 px-4 py-3 sticky top-0 z-30 shadow-sm">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/patient/dashboard"
              className="text-primary-600 hover:text-primary-700 font-medium text-sm flex items-center gap-1 transition-colors"
            >
              ← Dashboard
            </Link>
            <span className="text-gray-300">|</span>
            <h1 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <span>🩺</span> Find Doctors Near You
            </h1>
          </div>
          <Link href="/patient/book" className="btn-secondary text-xs py-1.5 px-3">
            + Book Directly
          </Link>
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="max-w-6xl mx-auto px-4 py-6">
        {/* Header Hero Banner */}
        <div className="bg-gradient-to-r from-primary-600 to-sky-700 rounded-2xl p-6 sm:p-8 text-white mb-6 shadow-sm relative overflow-hidden">
          <div className="relative z-10 max-w-2xl">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 backdrop-blur-md text-xs font-medium mb-3">
              <span>📍</span> Geolocation-Powered Discovery
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight mb-2">
              Find Doctors Near You
            </h2>
            <p className="text-primary-100 text-sm sm:text-base leading-relaxed mb-6">
              Discover verified doctors and clinics based on your exact location, specialty, and
              real-time appointment availability.
            </p>

            {/* Geolocation Button & Status */}
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={requestLocation}
                disabled={geoStatus === 'requesting'}
                className="bg-white hover:bg-gray-50 text-primary-700 font-bold px-5 py-2.5 rounded-xl shadow-md transition-all active:scale-95 text-sm flex items-center gap-2 disabled:opacity-75 cursor-pointer"
              >
                {geoStatus === 'requesting' ? (
                  <>
                    <svg className="animate-spin h-4 w-4 text-primary-600" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                    </svg>
                    <span>Detecting Location...</span>
                  </>
                ) : (
                  <>
                    <span className="text-base">📍</span>
                    <span>Use My Location</span>
                  </>
                )}
              </button>

              {geoStatus === 'granted' && userLocation && (
                <div className="flex items-center gap-1.5 text-xs bg-emerald-500/20 backdrop-blur-md text-white border border-emerald-300/30 px-3 py-2 rounded-xl">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                  <span>Location detected</span>
                </div>
              )}
            </div>

            {/* Geolocation Notices */}
            {geoStatus === 'denied' && (
              <div className="mt-4 p-3 bg-red-500/20 backdrop-blur-md border border-red-300/40 rounded-xl text-xs text-white max-w-lg">
                ⚠️ Location access was denied. You can search doctors by city or specialty using the
                search filters below.
              </div>
            )}
            {geoStatus === 'unavailable' && (
              <div className="mt-4 p-3 bg-amber-500/20 backdrop-blur-md border border-amber-300/40 rounded-xl text-xs text-white max-w-lg">
                ⚠️ Location is currently unavailable on your device. Please search by city below.
              </div>
            )}
            {geoStatus === 'timeout' && (
              <div className="mt-4 p-3 bg-amber-500/20 backdrop-blur-md border border-amber-300/40 rounded-xl text-xs text-white max-w-lg">
                ⚠️ Location request timed out. Please try clicking again or search by city.
              </div>
            )}
            {geoStatus === 'unsupported' && (
              <div className="mt-4 p-3 bg-gray-500/20 backdrop-blur-md border border-gray-300/40 rounded-xl text-xs text-white max-w-lg">
                ⚠️ Your browser does not support geolocation. Please search by city below.
              </div>
            )}
          </div>
        </div>

        {/* Search & Filter Bar */}
        <div className="card mb-6 bg-white border border-gray-200 shadow-sm p-4 sm:p-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
            {/* Keyword Search */}
            <div>
              <label className="label text-xs">Search</label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Doctor name, clinic, etc."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="input pl-8 text-xs"
                />
                <span className="absolute left-2.5 top-2.5 text-gray-400 text-xs">🔍</span>
              </div>
            </div>

            {/* City Search Fallback */}
            <div>
              <label className="label text-xs">City / Area</label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="e.g. Bhopal, Delhi"
                  value={cityInput}
                  onChange={(e) => setCityInput(e.target.value)}
                  className="input pl-8 text-xs"
                />
                <span className="absolute left-2.5 top-2.5 text-gray-400 text-xs">🏙️</span>
              </div>
            </div>

            {/* Specialty Dropdown */}
            <div>
              <label className="label text-xs">Specialty</label>
              <select
                value={selectedSpecialty}
                onChange={(e) => setSelectedSpecialty(e.target.value)}
                className="input text-xs"
              >
                <option value="">All Specialties</option>
                {availableSpecialties.map((spec) => (
                  <option key={spec} value={spec}>
                    {spec}
                  </option>
                ))}
              </select>
            </div>

            {/* Availability Filter */}
            <div>
              <label className="label text-xs">Availability</label>
              <select
                value={availabilityFilter}
                onChange={(e) =>
                  setAvailabilityFilter(e.target.value as 'all' | 'today' | 'week')
                }
                className="input text-xs"
              >
                <option value="all">All Doctors</option>
                <option value="today">Available Today</option>
                <option value="week">Available This Week</option>
              </select>
            </div>
          </div>

          {/* Secondary Controls: Radius, Sort & View Toggle */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-gray-100">
            <div className="flex flex-wrap items-center gap-3 text-xs text-gray-600">
              {/* Radius Filter */}
              <div className="flex items-center gap-1.5">
                <span className="font-medium text-gray-700">Radius:</span>
                <select
                  value={radiusKm}
                  onChange={(e) => setRadiusKm(Number(e.target.value))}
                  disabled={!userLocation}
                  className="border border-gray-300 rounded-lg px-2 py-1 bg-white text-xs disabled:opacity-50"
                  title={!userLocation ? 'Enable location to filter by distance' : ''}
                >
                  <option value={1}>1 km</option>
                  <option value={5}>5 km</option>
                  <option value={10}>10 km (Default)</option>
                  <option value={25}>25 km</option>
                  <option value={50}>50 km</option>
                </select>
              </div>

              {/* Sort By */}
              <div className="flex items-center gap-1.5">
                <span className="font-medium text-gray-700">Sort by:</span>
                <select
                  value={sortBy}
                  onChange={(e) =>
                    setSortBy(e.target.value as 'distance' | 'availability' | 'name')
                  }
                  className="border border-gray-300 rounded-lg px-2 py-1 bg-white text-xs"
                >
                  <option value="distance" disabled={!userLocation}>
                    Nearest First {!userLocation && '(Need Location)'}
                  </option>
                  <option value="availability">Available Soon</option>
                  <option value="name">Doctor Name</option>
                </select>
              </div>
            </div>

            {/* View Mode Toggle: List vs Map */}
            <div className="flex items-center bg-gray-100 p-1 rounded-lg border border-gray-200">
              <button
                type="button"
                onClick={() => setViewMode('list')}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                  viewMode === 'list'
                    ? 'bg-white text-primary-700 shadow-xs'
                    : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                📋 List View
              </button>
              <button
                type="button"
                onClick={() => setViewMode('map')}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                  viewMode === 'map'
                    ? 'bg-white text-primary-700 shadow-xs'
                    : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                🗺️ Map View
              </button>
            </div>
          </div>
        </div>

        {/* Results Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="text-sm font-medium text-gray-700">
            {loading ? (
              <span>Finding doctors...</span>
            ) : (
              <span>
                Found <strong className="text-gray-900">{doctors.length}</strong> doctor
                {doctors.length === 1 ? '' : 's'}
                {userLocation && ` within ${radiusKm} km`}
                {cityInput && ` in "${cityInput}"`}
              </span>
            )}
          </div>
          {userLocation && (
            <span className="text-xs text-gray-500">
              Sorted by: {sortBy === 'distance' ? 'Nearest distance' : sortBy}
            </span>
          )}
        </div>

        {/* Error State */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl p-4 mb-6 flex items-center justify-between">
            <p>{error}</p>
            <button
              onClick={() => fetchDoctors(userLocation)}
              className="btn-primary text-xs py-1 px-3"
            >
              Retry
            </button>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="card animate-pulse h-48 bg-white border border-gray-100 p-5">
                <div className="flex gap-3 mb-4">
                  <div className="w-12 h-12 rounded-xl bg-gray-200 shrink-0"></div>
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                    <div className="h-3 bg-gray-100 rounded w-1/2"></div>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="h-3 bg-gray-100 rounded w-full"></div>
                  <div className="h-3 bg-gray-100 rounded w-2/3"></div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty States */}
        {!loading && doctors.length === 0 && (
          <div className="card text-center py-12 px-6 bg-white border border-gray-100 max-w-lg mx-auto">
            <div className="text-4xl mb-3">🔍</div>
            <h3 className="text-lg font-bold text-gray-900 mb-1">No doctors found</h3>
            <p className="text-sm text-gray-500 mb-6">
              {userLocation
                ? `No doctors found within ${radiusKm} km matching your filters. Try increasing the search radius or clearing filters.`
                : 'No doctors matched your current search filters. Try searching by city or specialty.'}
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              {userLocation && radiusKm < 50 && (
                <button
                  type="button"
                  onClick={() => setRadiusKm(50)}
                  className="btn-primary text-xs py-2 px-4"
                >
                  Expand Radius to 50 km
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setSelectedSpecialty('');
                  setCityInput('');
                  setAvailabilityFilter('all');
                }}
                className="btn-secondary text-xs py-2 px-4"
              >
                Clear Filters
              </button>
            </div>
          </div>
        )}

        {/* Map View */}
        {!loading && viewMode === 'map' && doctors.length > 0 && (
          <div className="mb-6 space-y-4">
            <NearbyDoctorsMap
              doctors={doctors}
              userLocation={userLocation}
              selectedDoctorId={selectedDoctor?.id}
              onSelectDoctor={(doc) => setSelectedDoctor(doc)}
            />
            <p className="text-xs text-gray-500 text-center">
              💡 Click on any doctor marker to view clinic details and book an appointment directly.
            </p>
          </div>
        )}

        {/* List / Grid View */}
        {!loading && viewMode === 'list' && doctors.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {doctors.map((doctor) => (
              <DoctorNearbyCard
                key={doctor.id}
                doctor={doctor}
                onViewDetails={(doc) => setSelectedDoctor(doc)}
              />
            ))}
          </div>
        )}

        {/* Doctor Detail Modal */}
        {selectedDoctor && (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-gray-100 relative animate-in fade-in zoom-in duration-200">
              <button
                type="button"
                onClick={() => setSelectedDoctor(null)}
                className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-100 text-lg"
              >
                ✕
              </button>

              <div className="flex items-center gap-3 mb-4">
                <div className="w-14 h-14 rounded-2xl bg-primary-100 text-primary-700 font-bold text-xl flex items-center justify-center">
                  {selectedDoctor.name.replace(/^Dr\.\s*/i, '').charAt(0) || 'D'}
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900">
                    {selectedDoctor.name.startsWith('Dr.')
                      ? selectedDoctor.name
                      : `Dr. ${selectedDoctor.name}`}
                  </h3>
                  <p className="text-sm font-semibold text-primary-600">
                    {selectedDoctor.specialization}
                  </p>
                </div>
              </div>

              {/* Status and Distance */}
              <div className="flex flex-wrap gap-2 mb-4">
                <span
                  className={`inline-flex items-center text-xs font-medium px-2.5 py-1 rounded-full border ${selectedDoctor.availability.badgeClass}`}
                >
                  {selectedDoctor.availability.label}
                </span>
                {selectedDoctor.distanceKm !== null && (
                  <span className="inline-flex items-center text-xs font-semibold px-2.5 py-1 rounded-full bg-primary-50 text-primary-700 border border-primary-200">
                    📍 {formatDistance(selectedDoctor.distanceKm)}
                  </span>
                )}
              </div>

              {/* Details List */}
              <div className="space-y-3 text-sm border-t border-b border-gray-100 py-4 mb-6">
                {selectedDoctor.clinicName && (
                  <div>
                    <span className="text-gray-400 text-xs block">Clinic / Hospital</span>
                    <span className="font-medium text-gray-800">{selectedDoctor.clinicName}</span>
                  </div>
                )}
                {(selectedDoctor.clinicAddress || selectedDoctor.address) && (
                  <div>
                    <span className="text-gray-400 text-xs block">Address</span>
                    <span className="text-gray-700">
                      {[
                        selectedDoctor.clinicAddress || selectedDoctor.address,
                        selectedDoctor.city,
                        selectedDoctor.state,
                        selectedDoctor.postalCode,
                      ]
                        .filter(Boolean)
                        .join(', ')}
                    </span>
                  </div>
                )}
                {selectedDoctor.phone && (
                  <div>
                    <span className="text-gray-400 text-xs block">Contact Phone</span>
                    <span className="text-gray-700">{selectedDoctor.phone}</span>
                  </div>
                )}
                {selectedDoctor.bio && (
                  <div>
                    <span className="text-gray-400 text-xs block">About Doctor</span>
                    <p className="text-gray-600 text-xs leading-relaxed mt-0.5">
                      {selectedDoctor.bio}
                    </p>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setSelectedDoctor(null)}
                  className="btn-secondary flex-1 text-sm py-2.5"
                >
                  Close
                </button>
                <Link
                  href={`/patient/book?doctorId=${selectedDoctor.id}`}
                  className="btn-primary flex-1 text-sm py-2.5 text-center flex items-center justify-center gap-1.5"
                >
                  Book Appointment
                  <span>→</span>
                </Link>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
