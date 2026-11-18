'use strict';

// Shared input validation for pickup requests, tracking lookups and admin forms.

function cleanText(value, max = 255) {
  if (value === null || value === undefined) return '';
  return String(value).replace(/\s+/g, ' ').trim().slice(0, max);
}

/**
 * Normalise a Ghana phone number to 0XXXXXXXXX.
 * Accepts spaces, dashes, brackets and +233 country codes.
 */
function normalisePhone(value) {
  const raw = cleanText(value, 30);
  if (!raw) return null;
  let digits = raw.replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('233')) digits = '0' + digits.slice(3);
  if (digits.length === 9) digits = '0' + digits;
  return /^0\d{9}$/.test(digits) ? digits : null;
}

function phoneDigits(value) {
  return cleanText(value, 30).replace(/\D/g, '');
}

/** Returns null when valid, otherwise a short error code. */
function validateDate(value) {
  const raw = cleanText(value, 20);
  if (!raw) return null; // preferred date is optional
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return 'invalid';

  const [year, month, day] = raw.split('-').map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (parsed.getUTCFullYear() !== year || parsed.getUTCMonth() + 1 !== month || parsed.getUTCDate() !== day) {
    return 'invalid';
  }

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  if (parsed.getTime() < today.getTime()) return 'past';
  if (parsed.getTime() > today.getTime() + 90 * 24 * 60 * 60 * 1000) return 'too_far';
  return null;
}

/** The request form uses fixed time slots rather than free-form times. */
function validateTimeSlot(value) {
  const raw = cleanText(value, 40);
  if (!raw) return null;
  return /^(Morning|Afternoon|Evening)\b/i.test(raw) ? null : 'invalid';
}

function isTerminalStatus(status) {
  return ['Completed', 'Cancelled'].includes(String(status || ''));
}

module.exports = {
  cleanText,
  normalisePhone,
  phoneDigits,
  validateDate,
  validateTimeSlot,
  isTerminalStatus
};
