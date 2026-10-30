'use client';

const DEVICE_ID_KEY = 'tt_device_id';
const DEVICE_NAME_KEY = 'tt_device_name';

export function getOrCreateDeviceId(): string {
  if (typeof window === 'undefined') return '';
  let deviceId = localStorage.getItem(DEVICE_ID_KEY);
  if (!deviceId) {
    // Generate a secure random UUID for this device installation
    deviceId = crypto.randomUUID();
    localStorage.setItem(DEVICE_ID_KEY, deviceId);
  }
  return deviceId;
}

export function getDeviceName(): string {
  if (typeof window === 'undefined') return 'Unknown Device';
  let deviceName = localStorage.getItem(DEVICE_NAME_KEY);
  if (!deviceName) {
    const ua = navigator.userAgent;
    if (/iPhone/i.test(ua)) deviceName = 'Apple iPhone';
    else if (/iPad/i.test(ua)) deviceName = 'Apple iPad';
    else if (/Android/i.test(ua)) {
      const match = ua.match(/Android.*;\s([^;)]+)\)/);
      deviceName = match ? match[1].trim() : 'Android Phone';
    } else if (/Macintosh/i.test(ua)) deviceName = 'MacBook / Mac';
    else if (/Windows/i.test(ua)) deviceName = 'Windows PC';
    else deviceName = 'Mobile Device';
    
    localStorage.setItem(DEVICE_NAME_KEY, deviceName);
  }
  return deviceName;
}

