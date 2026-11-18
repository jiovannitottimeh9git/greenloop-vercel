'use strict';

// Helpers for live driver GPS tracking. Kept free of DB/HTTP concerns so the
// API routes and frontend can share the same validation and distance logic.

const EARTH_RADIUS_KM = 6371;
const DEFAULT_SPEED_KMH = 25;

function toFiniteNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function isValidLatitude(value) {
  const number = toFiniteNumber(value);
  return number !== null && number >= -90 && number <= 90;
}

function isValidLongitude(value) {
  const number = toFiniteNumber(value);
  return number !== null && number >= -180 && number <= 180;
}

function clamp(value, min, max) {
  const number = toFiniteNumber(value);
  if (number === null) return null;
  return Math.min(max, Math.max(min, number));
}

/**
 * Validate and normalise a GPS fix coming from a driver's phone.
 * Accepts latitude/longitude (preferred) or lat/lng aliases.
 */
function normaliseFix(input = {}) {
  const latitude = toFiniteNumber(input.latitude ?? input.lat);
  const longitude = toFiniteNumber(input.longitude ?? input.lng ?? input.lon);
  if (!isValidLatitude(latitude) || !isValidLongitude(longitude)) return null;

  return {
    latitude,
    longitude,
    accuracy: clamp(input.accuracy, 0, 10000),
    heading: clamp(input.heading, 0, 360),
    speed: clamp(input.speed, 0, 500)
  };
}

/** Great-circle distance in kilometres between two {latitude, longitude} points. */
function distanceKm(from, to) {
  if (!from || !to) return null;
  const lat1 = toFiniteNumber(from.latitude);
  const lon1 = toFiniteNumber(from.longitude);
  const lat2 = toFiniteNumber(to.latitude);
  const lon2 = toFiniteNumber(to.longitude);
  if ([lat1, lon1, lat2, lon2].some((value) => value === null)) return null;

  const radians = (degrees) => (degrees * Math.PI) / 180;
  const dLat = radians(lat2 - lat1);
  const dLon = radians(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(radians(lat1)) * Math.cos(radians(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(a)));
}

/** Rough arrival estimate used only for display, never for dispatch decisions. */
function arrivalMinutes(distanceInKm, speedKmh = DEFAULT_SPEED_KMH) {
  if (distanceInKm === null || distanceInKm === undefined) return null;
  const speed = toFiniteNumber(speedKmh) || DEFAULT_SPEED_KMH;
  return Math.max(1, Math.round((distanceInKm / speed) * 60));
}

/** Human-readable "how old is this GPS fix" label for the tracking page. */
function ageLabel(timestamp) {
  if (!timestamp) return 'Waiting for location';
  const time = new Date(timestamp).getTime();
  if (!Number.isFinite(time)) return 'Waiting for location';

  const seconds = Math.max(0, Math.round((Date.now() - time) / 1000));
  if (seconds < 10) return 'Updated just now';
  if (seconds < 60) return `Updated ${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `Updated ${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  return `Updated ${hours} hr ago`;
}

module.exports = {
  isValidLatitude,
  isValidLongitude,
  normaliseFix,
  distanceKm,
  arrivalMinutes,
  ageLabel
};
