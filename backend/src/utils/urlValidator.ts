import { URL } from 'url';
import net from 'net';

/**
 * Validates that a URL is a legitimate public web URL
 * and prevents Server-Side Request Forgery (SSRF) against private/internal networks.
 */
export function isSafePublicUrl(urlString: string): { isValid: boolean; reason?: string } {
  if (!urlString) {
    return { isValid: false, reason: 'URL cannot be empty' };
  }

  try {
    const parsed = new URL(urlString);

    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return { isValid: false, reason: 'Only HTTP and HTTPS protocols are allowed' };
    }

    const hostname = parsed.hostname.toLowerCase();

    // Check for localhost or loopback names
    if (
      hostname === 'localhost' ||
      hostname.endsWith('.localhost') ||
      hostname.endsWith('.local') ||
      hostname.endsWith('.internal') ||
      hostname.endsWith('.lan')
    ) {
      return { isValid: false, reason: 'Local and internal domains are not permitted' };
    }

    // If hostname is an IP address, check for private ranges
    if (net.isIP(hostname)) {
      if (isPrivateIp(hostname)) {
        return { isValid: false, reason: 'Private IP addresses are not permitted' };
      }
    }

    return { isValid: true };
  } catch (err: any) {
    return { isValid: false, reason: `Malformed URL: ${err.message}` };
  }
}

function isPrivateIp(ip: string): boolean {
  // IPv4 checks
  if (net.isIPv4(ip)) {
    const parts = ip.split('.').map((p) => parseInt(p, 10));

    // 0.0.0.0/8 (Broadcast/Current)
    if (parts[0] === 0) return true;
    // 10.0.0.0/8 (Private)
    if (parts[0] === 10) return true;
    // 127.0.0.0/8 (Loopback)
    if (parts[0] === 127) return true;
    // 169.254.0.0/16 (Link Local)
    if (parts[0] === 169 && parts[1] === 254) return true;
    // 172.16.0.0/12 (Private)
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
    // 192.168.0.0/16 (Private)
    if (parts[0] === 192 && parts[1] === 168) return true;
    // 224.0.0.0/4 (Multicast)
    if (parts[0] >= 224) return true;

    return false;
  }

  // IPv6 checks
  if (net.isIPv6(ip)) {
    const normalized = ip.toLowerCase();
    if (normalized === '::1' || normalized === '::') return true;
    // Unique local address fc00::/7
    if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true;
    // Link local fe80::/10
    if (normalized.startsWith('fe80:')) return true;
  }

  return false;
}
