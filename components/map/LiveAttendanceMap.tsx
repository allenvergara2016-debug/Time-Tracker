'use client';

import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { AttendanceLog, Location } from '@/types/database.types';

interface Props {
  attendanceLogs: AttendanceLog[];
  locations: Location[];
}

export default function LiveAttendanceMap({ attendanceLogs, locations }: Props) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);

  useEffect(() => {
    delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
      iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
      shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    });

    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const initialLat = locations[0]?.lat || 14.5547;
    const initialLng = locations[0]?.lng || 121.0244;

    const map = L.map(mapContainerRef.current).setView([initialLat, initialLng], 13);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map);

    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Clear existing markers/circles
    map.eachLayer((layer) => {
      if (layer instanceof L.TileLayer) return;
      map.removeLayer(layer);
    });

    // 1. Draw Office Geofence circles
    locations.forEach((loc) => {
      L.circle([loc.lat, loc.lng], {
        radius: loc.radius_meters,
        color: '#2563eb',
        fillColor: '#3b82f6',
        fillOpacity: 0.15,
      }).addTo(map);

      const officeIcon = L.divIcon({
        className: 'custom-div-icon',
        html: `<div style="background-color: #1e40af; color: white; padding: 3px 6px; border-radius: 6px; font-size: 11px; font-weight: bold; white-space: nowrap; box-shadow: 0 2px 4px rgba(0,0,0,0.2);">${loc.name}</div>`,
        iconSize: [60, 20],
        iconAnchor: [30, 25],
      });

      L.marker([loc.lat, loc.lng], { icon: officeIcon }).addTo(map);
    });

    // 2. Draw employee tap markers
    attendanceLogs.forEach((log) => {
      if (!log.lat_in || !log.lng_in) return;

      const employeeName = log.profile?.full_name || 'Employee';
      const timeInStr = new Date(log.time_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const isLate = log.status === 'late';

      const empIcon = L.divIcon({
        className: 'custom-emp-icon',
        html: `<div style="background-color: ${isLate ? '#f59e0b' : '#10b981'}; width: 14px; height: 14px; border: 2px solid white; border-radius: 50%; box-shadow: 0 0 6px rgba(0,0,0,0.3);"></div>`,
        iconSize: [14, 14],
        iconAnchor: [7, 7],
      });

      const marker = L.marker([log.lat_in, log.lng_in], { icon: empIcon }).addTo(map);

      marker.bindPopup(`
        <div style="font-family: sans-serif; font-size: 12px; min-width: 140px;">
          <b style="font-size: 13px;">${employeeName}</b><br/>
          Time In: <b>${timeInStr}</b><br/>
          Status: <span style="font-weight: 600; color: ${isLate ? '#d97706' : '#059669'};">${log.status.toUpperCase()}</span><br/>
          Method: <i>${log.verification_method}</i><br/>
          Accuracy: ±${Math.round(log.accuracy_in || 0)}m
        </div>
      `);
    });
  }, [attendanceLogs, locations]);

  return (
    <div className="w-full h-full min-h-[400px] rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-sm relative">
      <div ref={mapContainerRef} className="w-full h-full min-h-[400px] z-0" />
      <div className="absolute bottom-3 left-3 z-[1000] bg-white/90 dark:bg-slate-900/90 backdrop-blur-md px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 text-xs shadow-md flex items-center gap-4">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
          <span className="text-slate-700 dark:text-slate-300">On Time Tap</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" />
          <span className="text-slate-700 dark:text-slate-300">Late Tap</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block" />
          <span className="text-slate-700 dark:text-slate-300">Office Radius</span>
        </div>
      </div>
    </div>
  );
}

