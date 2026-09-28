'use client';

import React, { useEffect, useRef } from 'react';
import type { NearbyDoctor } from './DoctorNearbyCard';
import { formatDistance } from '@/lib/distance';
import Link from 'next/link';

interface NearbyDoctorsMapProps {
  doctors: NearbyDoctor[];
  userLocation: { latitude: number; longitude: number } | null;
  selectedDoctorId?: string | null;
  onSelectDoctor?: (doctor: NearbyDoctor) => void;
}

export default function NearbyDoctorsMap({
  doctors,
  userLocation,
  selectedDoctorId,
  onSelectDoctor,
}: NearbyDoctorsMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersGroupRef = useRef<any>(null);

  useEffect(() => {
    // Import leaflet dynamically only in browser
    let isMounted = true;

    async function initMap() {
      if (typeof window === 'undefined' || !mapContainerRef.current) return;

      const L = (await import('leaflet')).default;

      // Inject Leaflet CSS if not already present
      if (!document.getElementById('leaflet-css')) {
        const link = document.createElement('link');
        link.id = 'leaflet-css';
        link.rel = 'stylesheet';
        link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        document.head.appendChild(link);
      }

      // Default center: user coordinates or first doctor with coordinates or India center
      let initialLat = 23.25;
      let initialLng = 77.41;
      let initialZoom = 12;

      if (userLocation) {
        initialLat = userLocation.latitude;
        initialLng = userLocation.longitude;
        initialZoom = 13;
      } else {
        const firstWithCoords = doctors.find(
          (d) => typeof d.latitude === 'number' && typeof d.longitude === 'number'
        );
        if (firstWithCoords) {
          initialLat = firstWithCoords.latitude!;
          initialLng = firstWithCoords.longitude!;
        }
      }

      if (!mapInstanceRef.current && mapContainerRef.current) {
        mapInstanceRef.current = L.map(mapContainerRef.current).setView(
          [initialLat, initialLng],
          initialZoom
        );

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; OpenStreetMap contributors',
          maxZoom: 19,
        }).addTo(mapInstanceRef.current);

        markersGroupRef.current = L.layerGroup().addTo(mapInstanceRef.current);
      }

      if (!mapInstanceRef.current || !markersGroupRef.current) return;

      const markersGroup = markersGroupRef.current;
      markersGroup.clearLayers();

      const bounds: [number, number][] = [];

      // 1. Add user location marker
      if (userLocation) {
        bounds.push([userLocation.latitude, userLocation.longitude]);

        const userIcon = L.divIcon({
          className: 'custom-user-marker',
          html: `
            <div style="position:relative; width:24px; height:24px;">
              <div style="position:absolute; width:24px; height:24px; border-radius:50%; background-color:#3b82f6; opacity:0.3; animation:ping 1.5s cubic-bezier(0,0,0.2,1) infinite;"></div>
              <div style="position:absolute; top:4px; left:4px; width:16px; height:16px; border-radius:50%; background-color:#2563eb; border:3px solid white; box-shadow:0 2px 6px rgba(0,0,0,0.3);"></div>
            </div>
          `,
          iconSize: [24, 24],
          iconAnchor: [12, 12],
        });

        L.marker([userLocation.latitude, userLocation.longitude], {
          icon: userIcon,
          zIndexOffset: 1000,
        })
          .addTo(markersGroup)
          .bindPopup(`
            <div style="text-align:center; font-family:inherit;">
              <strong style="color:#1e3a8a;">📍 You are here</strong>
            </div>
          `);
      }

      // 2. Add doctor markers
      doctors.forEach((doc) => {
        if (typeof doc.latitude !== 'number' || typeof doc.longitude !== 'number') return;

        bounds.push([doc.latitude, doc.longitude]);

        const isSelected = selectedDoctorId === doc.id;
        const pinBgColor = isSelected ? '#0d9488' : '#0284c7';

        const doctorIcon = L.divIcon({
          className: 'custom-doctor-marker',
          html: `
            <div style="
              width: 32px;
              height: 32px;
              background-color: ${pinBgColor};
              border: 2px solid white;
              border-radius: 50% 50% 50% 0;
              transform: rotate(-45deg);
              display: flex;
              align-items: center;
              justify-content: center;
              box-shadow: 0 3px 8px rgba(0,0,0,0.3);
              cursor: pointer;
            ">
              <span style="
                transform: rotate(45deg);
                color: white;
                font-size: 14px;
                font-weight: bold;
              ">🩺</span>
            </div>
          `,
          iconSize: [32, 32],
          iconAnchor: [16, 32],
          popupAnchor: [0, -32],
        });

        const popupContent = `
          <div style="min-width: 180px; font-family: inherit; padding: 4px 0;">
            <div style="font-weight: 700; font-size: 14px; color: #111827;">${doc.name.startsWith('Dr.') ? doc.name : `Dr. ${doc.name}`}</div>
            <div style="font-size: 12px; color: #0284c7; font-weight: 600; margin-bottom: 4px;">${doc.specialization}</div>
            ${doc.distanceKm !== null ? `<div style="font-size: 11px; color: #4b5563; margin-bottom: 4px;">📍 ${formatDistance(doc.distanceKm)}</div>` : ''}
            ${doc.clinicName ? `<div style="font-size: 11px; color: #6b7280;">🏥 ${doc.clinicName}</div>` : ''}
            <div style="margin-top: 8px; display: flex; gap: 6px;">
              <a href="/patient/book?doctorId=${doc.id}" style="
                display: inline-block;
                background-color: #0284c7;
                color: white;
                padding: 4px 8px;
                border-radius: 6px;
                font-size: 11px;
                text-decoration: none;
                font-weight: 600;
                text-align: center;
                flex: 1;
              ">Book Appointment</a>
            </div>
          </div>
        `;

        const marker = L.marker([doc.latitude, doc.longitude], { icon: doctorIcon })
          .addTo(markersGroup)
          .bindPopup(popupContent);

        marker.on('click', () => {
          if (onSelectDoctor) {
            onSelectDoctor(doc);
          }
        });
      });

      // Adjust viewport to show all markers
      if (bounds.length > 1) {
        mapInstanceRef.current.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
      } else if (bounds.length === 1) {
        mapInstanceRef.current.setView(bounds[0], 13);
      }
    }

    initMap();

    return () => {
      isMounted = false;
    };
  }, [doctors, userLocation, selectedDoctorId, onSelectDoctor]);

  return (
    <div className="relative w-full h-[450px] md:h-[550px] rounded-xl overflow-hidden border border-gray-200 shadow-inner bg-gray-100">
      <div ref={mapContainerRef} className="w-full h-full z-0" />
      <div className="absolute bottom-3 left-3 z-[1000] bg-white/95 backdrop-blur-sm px-3 py-1.5 rounded-lg shadow-sm border border-gray-200 text-xs text-gray-600 flex items-center gap-3">
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-blue-600 inline-block border border-white" />
          <span>You</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-sky-600 inline-block border border-white" />
          <span>Doctors ({doctors.filter(d => d.latitude && d.longitude).length})</span>
        </div>
      </div>
    </div>
  );
}
