'use client';

import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Location } from '@/types/database.types';
import { Plus, Check, Trash2, MapPin } from 'lucide-react';

interface Props {
  locations: Location[];
  onAddLocation: (loc: { name: string; address: string; lat: number; lng: number; radius_meters: number }) => Promise<void>;
  onDeleteLocation: (id: string) => Promise<void>;
}

export default function LocationAdminMap({ locations, onAddLocation, onDeleteLocation }: Props) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const tempMarkerRef = useRef<L.Marker | null>(null);
  const tempCircleRef = useRef<L.Circle | null>(null);

  const [selectedCoords, setSelectedCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [radius, setRadius] = useState(100);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    // Fix default marker icon in leaflet
    delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
      iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
      shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    });

    if (!mapContainerRef.current || mapInstanceRef.current) return;

    // Default center (Metro Manila or first location)
    const initialLat = locations[0]?.lat || 14.5547;
    const initialLng = locations[0]?.lng || 121.0244;

    const map = L.map(mapContainerRef.current).setView([initialLat, initialLng], 14);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map);

    mapInstanceRef.current = map;

    // Click handler to select new location coordinates
    map.on('click', (e: L.LeafletMouseEvent) => {
      const { lat, lng } = e.latlng;
      setSelectedCoords({ lat, lng });
    });

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Update existing locations layer on map
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Clear non-temp layers
    map.eachLayer((layer) => {
      if (layer instanceof L.TileLayer) return;
      if (layer === tempMarkerRef.current || layer === tempCircleRef.current) return;
      map.removeLayer(layer);
    });

    locations.forEach((loc) => {
      const marker = L.marker([loc.lat, loc.lng]).addTo(map);
      marker.bindPopup(`
        <div style="font-family: sans-serif; font-size: 13px;">
          <b>${loc.name}</b><br/>
          ${loc.address ? `<span style="color:#666">${loc.address}</span><br/>` : ''}
          Radius: <b>${loc.radius_meters}m</b><br/>
          Status: <span style="color:${loc.is_active ? 'green' : 'red'}">${loc.is_active ? 'Active' : 'Inactive'}</span>
        </div>
      `);

      L.circle([loc.lat, loc.lng], {
        radius: loc.radius_meters,
        color: loc.is_active ? '#3b82f6' : '#9ca3af',
        fillColor: loc.is_active ? '#60a5fa' : '#d1d5db',
        fillOpacity: 0.25,
      }).addTo(map);
    });
  }, [locations]);

  // Update temporary marker when admin clicks map or changes radius
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (tempMarkerRef.current) map.removeLayer(tempMarkerRef.current);
    if (tempCircleRef.current) map.removeLayer(tempCircleRef.current);

    if (selectedCoords) {
      tempMarkerRef.current = L.marker([selectedCoords.lat, selectedCoords.lng]).addTo(map);
      tempCircleRef.current = L.circle([selectedCoords.lat, selectedCoords.lng], {
        radius,
        color: '#10b981',
        fillColor: '#34d399',
        fillOpacity: 0.35,
        dashArray: '4, 4',
      }).addTo(map);
    }
  }, [selectedCoords, radius]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCoords || !name) return;

    try {
      setIsSubmitting(true);
      await onAddLocation({
        name,
        address,
        lat: selectedCoords.lat,
        lng: selectedCoords.lng,
        radius_meters: radius,
      });

      // Reset form
      setName('');
      setAddress('');
      setSelectedCoords(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Map display */}
      <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <MapPin className="w-5 h-5 text-blue-600" />
            <h3 className="font-semibold text-slate-800 dark:text-slate-100">Interactive Location Map</h3>
          </div>
          <span className="text-xs text-slate-500 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-full">
            Click map to set office geofence pin
          </span>
        </div>
        <div ref={mapContainerRef} className="w-full h-[450px] z-0" />
      </div>

      {/* Add & list locations side panel */}
      <div className="space-y-6">
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm">
          <h3 className="font-semibold text-slate-800 dark:text-slate-100 mb-3 flex items-center gap-2">
            <Plus className="w-4 h-4 text-emerald-600" />
            Add Allowed Location
          </h3>

          {selectedCoords ? (
            <form onSubmit={handleSubmit} className="space-y-4 text-sm">
              <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl text-emerald-800 dark:text-emerald-300 text-xs">
                Selected Coordinates: <b>{selectedCoords.lat.toFixed(5)}, {selectedCoords.lng.toFixed(5)}</b>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Location Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Headquarters / Site A"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 border rounded-xl border-slate-300 dark:border-slate-700 bg-transparent text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Street Address (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. 100 Innovation Plaza"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full px-3 py-2 border rounded-xl border-slate-300 dark:border-slate-700 bg-transparent text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                    Radius: <b>{radius} meters</b>
                  </label>
                  <span className="text-[11px] text-slate-500">(Zone circle on map)</span>
                </div>
                <input
                  type="range"
                  min="20"
                  max="1000"
                  step="10"
                  value={radius}
                  onChange={(e) => setRadius(Number(e.target.value))}
                  className="w-full accent-blue-600"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl transition flex items-center justify-center gap-2 shadow-sm"
              >
                <Check className="w-4 h-4" />
                {isSubmitting ? 'Saving...' : 'Save Location & Geofence'}
              </button>
            </form>
          ) : (
            <p className="text-xs text-slate-500 dark:text-slate-400 py-4 text-center">
              Tap anywhere on the map to place a pin and create a new geofence zone.
            </p>
          )}
        </div>

        {/* Existing locations list */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm">
          <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">
            Active Geofences ({locations.length})
          </h4>
          <div className="space-y-3 max-h-[300px] overflow-y-auto">
            {locations.map((loc) => (
              <div
                key={loc.id}
                className="p-3 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex items-start justify-between"
              >
                <div>
                  <h5 className="font-semibold text-sm text-slate-900 dark:text-white">{loc.name}</h5>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{loc.address || 'No address specified'}</p>
                  <span className="inline-block mt-1 text-[11px] font-medium text-blue-600 dark:text-blue-400">
                    Radius: {loc.radius_meters}m
                  </span>
                </div>
                <button
                  onClick={() => onDeleteLocation(loc.id)}
                  className="text-slate-400 hover:text-red-500 p-1 transition"
                  title="Delete location"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

