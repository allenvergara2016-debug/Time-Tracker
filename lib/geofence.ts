/**
 * Calculates distance in meters between two lat/lng coordinates using the Haversine formula.
 */
export function calculateHaversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000; // Earth's radius in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export interface LocationMatchResult {
  isInside: boolean;
  matchedLocation: { id: string; name: string; radius_meters: number; distance: number } | null;
  nearestLocation: { id: string; name: string; radius_meters: number; distance: number } | null;
}

export function checkGeofence(
  userLat: number,
  userLng: number,
  locations: Array<{ id: string; name: string; lat: number; lng: number; radius_meters: number }>
): LocationMatchResult {
  if (!locations || locations.length === 0) {
    return { isInside: false, matchedLocation: null, nearestLocation: null };
  }

  let nearestLocation: { id: string; name: string; radius_meters: number; distance: number } | null = null;
  let matchedLocation: { id: string; name: string; radius_meters: number; distance: number } | null = null;

  for (const loc of locations) {
    const distance = calculateHaversineDistance(userLat, userLng, loc.lat, loc.lng);
    const locWithDist = { ...loc, distance };

    if (!nearestLocation || distance < nearestLocation.distance) {
      nearestLocation = locWithDist;
    }

    if (distance <= loc.radius_meters) {
      matchedLocation = locWithDist;
      break;
    }
  }

  return {
    isInside: !!matchedLocation,
    matchedLocation,
    nearestLocation,
  };
}

