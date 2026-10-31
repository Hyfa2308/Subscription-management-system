/**
 * REVORA – Application configuration constants.
 * All values read from Vite environment variables.
 */

export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000/api/v1';

export const APP_NAME = 'REVORA';
export const APP_TAGLINE =
  'Manage subscriptions. Automate billing. Predict risks. Protect revenue.';
export const APP_VERSION = '1.0.0';
