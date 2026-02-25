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
    const response = await axios.get(`https://ip-api.com/json/${ip}?fields=status,country,countryCode,city`, {
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
