import axios from 'axios';

interface GeoLocation {
  country: string | null;
  countryCode: string | null;
  city: string | null;
}

// Cache to avoid hitting the API too often
const geoCache = new Map<string, { data: GeoLocation; timestamp: number }>();
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Get country from IP address using free ip-api.com service
 * Falls back to Cloudflare headers if available
 */
export async function getCountryFromIP(
  ip: string,
  cfCountry?: string | null
): Promise<string | null> {
  // If Cloudflare header is available, use it
  if (cfCountry && cfCountry !== 'XX') {
    return cfCountry;
  }

  // Skip for localhost/private IPs
  if (
    !ip ||
    ip === 'unknown' ||
    ip === '127.0.0.1' ||
    ip === '::1' ||
    ip.startsWith('192.168.') ||
    ip.startsWith('10.') ||
    ip.startsWith('172.')
  ) {
    return null;
  }

  // Check cache
  const cached = geoCache.get(ip);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data.country;
  }

  try {
    // Use ip-api.com (free, 45 requests/minute for non-commercial use)
    const response = await axios.get(`http://ip-api.com/json/${ip}?fields=status,country,countryCode,city`, {
      timeout: 3000 // 3 second timeout
    });

    if (response.data.status === 'success') {
      const geoData: GeoLocation = {
        country: response.data.country || null,
        countryCode: response.data.countryCode || null,
        city: response.data.city || null
      };

      // Cache the result
      geoCache.set(ip, { data: geoData, timestamp: Date.now() });

      return geoData.country;
    }

    return null;
  } catch (error) {
    console.error('Geolocation lookup failed:', error);
    return null;
  }
}

/**
 * Clean expired entries from the cache periodically
 */
export function cleanGeoCache(): void {
  const now = Date.now();
  for (const [ip, entry] of geoCache.entries()) {
    if (now - entry.timestamp > CACHE_TTL) {
      geoCache.delete(ip);
    }
  }
}

// Clean cache every hour
setInterval(cleanGeoCache, 60 * 60 * 1000);

/**
 * Map of countries to their typical GMT offset
 * Uses the most common/capital city timezone for countries with multiple zones
 */
const countryToTimezone: Record<string, string> = {
  'Afghanistan': 'GMT+4.5',
  'Albania': 'GMT+1',
  'Algeria': 'GMT+1',
  'Argentina': 'GMT-3',
  'Australia': 'GMT+10',
  'Austria': 'GMT+1',
  'Bangladesh': 'GMT+6',
  'Belgium': 'GMT+1',
  'Brazil': 'GMT-3',
  'Bulgaria': 'GMT+2',
  'Canada': 'GMT-5',
  'Chile': 'GMT-3',
  'China': 'GMT+8',
  'Colombia': 'GMT-5',
  'Croatia': 'GMT+1',
  'Czech Republic': 'GMT+1',
  'Czechia': 'GMT+1',
  'Denmark': 'GMT+1',
  'Egypt': 'GMT+2',
  'Estonia': 'GMT+2',
  'Finland': 'GMT+2',
  'France': 'GMT+1',
  'Germany': 'GMT+1',
  'Greece': 'GMT+2',
  'Hong Kong': 'GMT+8',
  'Hungary': 'GMT+1',
  'India': 'GMT+5.5',
  'Indonesia': 'GMT+7',
  'Iran': 'GMT+3.5',
  'Iraq': 'GMT+3',
  'Ireland': 'GMT+0',
  'Israel': 'GMT+2',
  'Italy': 'GMT+1',
  'Japan': 'GMT+9',
  'Kenya': 'GMT+3',
  'Latvia': 'GMT+2',
  'Lithuania': 'GMT+2',
  'Malaysia': 'GMT+8',
  'Mexico': 'GMT-6',
  'Morocco': 'GMT+1',
  'Nepal': 'GMT+5.75',
  'Netherlands': 'GMT+1',
  'The Netherlands': 'GMT+1',
  'New Zealand': 'GMT+12',
  'Nigeria': 'GMT+1',
  'Norway': 'GMT+1',
  'Pakistan': 'GMT+5',
  'Peru': 'GMT-5',
  'Philippines': 'GMT+8',
  'Poland': 'GMT+1',
  'Portugal': 'GMT+0',
  'Romania': 'GMT+2',
  'Russia': 'GMT+3',
  'Saudi Arabia': 'GMT+3',
  'Serbia': 'GMT+1',
  'Singapore': 'GMT+8',
  'Slovakia': 'GMT+1',
  'Slovenia': 'GMT+1',
  'South Africa': 'GMT+2',
  'South Korea': 'GMT+9',
  'Spain': 'GMT+1',
  'Sweden': 'GMT+1',
  'Switzerland': 'GMT+1',
  'Taiwan': 'GMT+8',
  'Thailand': 'GMT+7',
  'Turkey': 'GMT+3',
  'Ukraine': 'GMT+2',
  'United Arab Emirates': 'GMT+4',
  'United Kingdom': 'GMT+0',
  'United States': 'GMT-5',
  'Venezuela': 'GMT-4',
  'Vietnam': 'GMT+7'
};

/**
 * Map of GMT offsets to likely countries (most common)
 */
const timezoneToCountry: Record<string, string> = {
  'GMT-12': 'United States',
  'GMT-11': 'United States',
  'GMT-10': 'United States',
  'GMT-9': 'United States',
  'GMT-8': 'United States',
  'GMT-7': 'United States',
  'GMT-6': 'Mexico',
  'GMT-5': 'United States',
  'GMT-4': 'Venezuela',
  'GMT-3': 'Brazil',
  'GMT-2': 'Brazil',
  'GMT-1': 'Portugal',
  'GMT+0': 'United Kingdom',
  'GMT+1': 'Germany',
  'GMT+2': 'South Africa',
  'GMT+3': 'Russia',
  'GMT+3.5': 'Iran',
  'GMT+4': 'United Arab Emirates',
  'GMT+4.5': 'Afghanistan',
  'GMT+5': 'Pakistan',
  'GMT+5.5': 'India',
  'GMT+5.75': 'Nepal',
  'GMT+6': 'Bangladesh',
  'GMT+7': 'Thailand',
  'GMT+8': 'China',
  'GMT+9': 'Japan',
  'GMT+10': 'Australia',
  'GMT+11': 'Australia',
  'GMT+12': 'New Zealand'
};

/**
 * Get typical timezone offset for a country
 */
export function getTimezoneFromCountry(country: string | null): string | null {
  if (!country) return null;
  return countryToTimezone[country] || null;
}

/**
 * Get likely country from timezone offset
 */
export function getCountryFromTimezone(timezone: string | null): string | null {
  if (!timezone) return null;
  return timezoneToCountry[timezone] || null;
}
