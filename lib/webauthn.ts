import { isoBase64URL } from '@simplewebauthn/server/helpers';

export const rpName = process.env.WEBAUTHN_RP_NAME || 'Time Tracker Biometrics';
export const rpID = process.env.WEBAUTHN_RP_ID || (
  process.env.VERCEL_URL ? new URL(`https://${process.env.VERCEL_URL}`).hostname : 'localhost'
);
export const origin = process.env.WEBAUTHN_ORIGIN || (
  process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000'
);

export function getWebAuthnConfig(req?: Request) {
  let hostname = rpID;
  let expectedOrigin = origin;

  if (req) {
    const hostHeader = req.headers.get('x-forwarded-host') || req.headers.get('host');
    if (hostHeader) {
      const cleanHost = hostHeader.split(':')[0];
      const proto = req.headers.get('x-forwarded-proto') || (cleanHost === 'localhost' || cleanHost === '127.0.0.1' ? 'http' : 'https');
      
      // If we are on a tunnel or deployed domain, adapt dynamically unless explicitly pinned
      if (!process.env.WEBAUTHN_RP_ID || process.env.WEBAUTHN_RP_ID === 'localhost') {
        hostname = cleanHost;
        expectedOrigin = `${proto}://${hostHeader}`;
      }
    }
  }

  return {
    rpName,
    rpID: hostname,
    origin: expectedOrigin,
  };
}

export function bufferToBase64Url(buffer: Uint8Array): string {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return isoBase64URL.fromBuffer(buffer as any);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function base64UrlToBuffer(base64: string): any {
  return isoBase64URL.toBuffer(base64);
}
