/**
 * Display timezone value
 */
export function getTimezoneDisplay(timezone: string | null | undefined, _country?: string | null | undefined): string {
  if (timezone) return timezone;
  return '-';
}

/**
 * Display country value (no inference from timezone)
 */
export function getCountryDisplay(country: string | null | undefined, _timezone?: string | null | undefined): string {
  if (country) return country;
  return '-';
}
