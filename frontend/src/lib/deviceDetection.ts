export interface DeviceInfo {
  deviceType: 'Desktop' | 'Mobile' | 'Tablet' | 'Unknown';
  os: string;
  browser: string;
  userAgent: string;
}

/**
 * Parse user agent string to extract device information
 */
export function parseUserAgent(userAgent: string): DeviceInfo {
  // Detect device type
  let deviceType: DeviceInfo['deviceType'] = 'Unknown';
  if (/ipad|tablet|playbook|silk|(android(?!.*mobile))/i.test(userAgent)) {
    deviceType = 'Tablet';
  } else if (/mobile|iphone|ipod|android|blackberry|opera mini|iemobile|wpdesktop/i.test(userAgent)) {
    deviceType = 'Mobile';
  } else if (/windows|macintosh|linux|cros/i.test(userAgent)) {
    deviceType = 'Desktop';
  }

  // Detect OS
  let os = 'Unknown';
  if (/windows nt 10/i.test(userAgent)) {
    os = 'Windows 10/11';
  } else if (/windows nt 6\.3/i.test(userAgent)) {
    os = 'Windows 8.1';
  } else if (/windows nt 6\.2/i.test(userAgent)) {
    os = 'Windows 8';
  } else if (/windows nt 6\.1/i.test(userAgent)) {
    os = 'Windows 7';
  } else if (/windows/i.test(userAgent)) {
    os = 'Windows';
  } else if (/iphone|ipad|ipod/i.test(userAgent)) {
    const match = userAgent.match(/OS (\d+[_\d]*)/i);
    os = match ? `iOS ${match[1].replace(/_/g, '.')}` : 'iOS';
  } else if (/mac os x/i.test(userAgent)) {
    const match = userAgent.match(/Mac OS X (\d+[_\d]*)/i);
    os = match ? `macOS ${match[1].replace(/_/g, '.')}` : 'macOS';
  } else if (/android/i.test(userAgent)) {
    const match = userAgent.match(/android (\d+[.\d]*)/i);
    os = match ? `Android ${match[1]}` : 'Android';
  } else if (/cros/i.test(userAgent)) {
    os = 'Chrome OS';
  } else if (/linux/i.test(userAgent)) {
    os = 'Linux';
  }

  // Detect browser
  let browser = 'Unknown';
  if (/edg\//i.test(userAgent)) {
    const match = userAgent.match(/Edg\/(\d+)/i);
    browser = match ? `Edge ${match[1]}` : 'Edge';
  } else if (/opr\/|opera/i.test(userAgent)) {
    const match = userAgent.match(/(?:opr|opera)\/(\d+)/i);
    browser = match ? `Opera ${match[1]}` : 'Opera';
  } else if (/chrome/i.test(userAgent) && !/chromium/i.test(userAgent)) {
    const match = userAgent.match(/Chrome\/(\d+)/i);
    browser = match ? `Chrome ${match[1]}` : 'Chrome';
  } else if (/safari/i.test(userAgent) && !/chrome/i.test(userAgent)) {
    const match = userAgent.match(/Version\/(\d+)/i);
    browser = match ? `Safari ${match[1]}` : 'Safari';
  } else if (/firefox/i.test(userAgent)) {
    const match = userAgent.match(/Firefox\/(\d+)/i);
    browser = match ? `Firefox ${match[1]}` : 'Firefox';
  } else if (/msie|trident/i.test(userAgent)) {
    browser = 'Internet Explorer';
  }

  return {
    deviceType,
    os,
    browser,
    userAgent
  };
}

/**
 * Get the current browser's device information
 */
export function getCurrentDeviceInfo(): DeviceInfo {
  return parseUserAgent(navigator.userAgent);
}

/**
 * Get a user-friendly summary of the device
 */
export function getDeviceSummary(info: DeviceInfo): string {
  const parts: string[] = [];

  if (info.deviceType !== 'Unknown') {
    parts.push(info.deviceType);
  }

  if (info.os !== 'Unknown') {
    parts.push(info.os);
  }

  if (info.browser !== 'Unknown') {
    parts.push(info.browser);
  }

  return parts.length > 0 ? parts.join(' | ') : 'Unknown device';
}

/**
 * Get an icon name based on device type
 */
export function getDeviceIcon(deviceType: DeviceInfo['deviceType']): 'desktop' | 'mobile' | 'tablet' {
  switch (deviceType) {
    case 'Desktop':
      return 'desktop';
    case 'Mobile':
      return 'mobile';
    case 'Tablet':
      return 'tablet';
    default:
      return 'desktop';
  }
}
