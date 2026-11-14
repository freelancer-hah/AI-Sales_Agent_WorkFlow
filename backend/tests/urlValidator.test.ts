import { describe, it, expect } from 'vitest';
import { isSafePublicUrl } from '../src/utils/urlValidator.js';
import { normalizeDomain, normalizeCompanyName, normalizeUrl } from '../src/utils/normalizer.js';

describe('URL and Domain Normalization', () => {
  it('should normalize domains correctly', () => {
    expect(normalizeDomain('https://www.example.com/about?ref=123')).toBe('example.com');
    expect(normalizeDomain('http://sub.domain.co.uk/path/')).toBe('sub.domain.co.uk');
    expect(normalizeDomain('WWW.TEST-COMPANY.ORG/')).toBe('test-company.org');
  });

  it('should normalize company names for deduplication', () => {
    expect(normalizeCompanyName('Acme Industrial, Inc.')).toBe('acme industrial');
    expect(normalizeCompanyName('Global Tech Solutions LLC.')).toBe('global tech solutions');
    expect(normalizeCompanyName('Apex Logistics Limited')).toBe('apex logistics');
  });

  it('should normalize URLs with default https', () => {
    expect(normalizeUrl('example.com')).toBe('https://example.com/');
    expect(normalizeUrl('https://example.com/about')).toBe('https://example.com/about');
  });
});

describe('SSRF Protection (isSafePublicUrl)', () => {
  it('should allow legitimate public URLs', () => {
    expect(isSafePublicUrl('https://google.com').isValid).toBe(true);
    expect(isSafePublicUrl('https://github.com/microsoft').isValid).toBe(true);
    expect(isSafePublicUrl('http://example.org').isValid).toBe(true);
  });

  it('should reject localhost and loopback domains', () => {
    expect(isSafePublicUrl('http://localhost:3000').isValid).toBe(false);
    expect(isSafePublicUrl('http://app.localhost').isValid).toBe(false);
    expect(isSafePublicUrl('http://server.local').isValid).toBe(false);
    expect(isSafePublicUrl('http://internal.lan').isValid).toBe(false);
  });

  it('should reject private IPv4 addresses', () => {
    expect(isSafePublicUrl('http://127.0.0.1:8080').isValid).toBe(false);
    expect(isSafePublicUrl('http://10.0.1.5').isValid).toBe(false);
    expect(isSafePublicUrl('http://172.16.0.1').isValid).toBe(false);
    expect(isSafePublicUrl('http://192.168.1.1').isValid).toBe(false);
    expect(isSafePublicUrl('http://169.254.169.254/latest/meta-data').isValid).toBe(false);
  });

  it('should reject non-HTTP protocols', () => {
    expect(isSafePublicUrl('file:///etc/passwd').isValid).toBe(false);
    expect(isSafePublicUrl('ftp://example.com').isValid).toBe(false);
    expect(isSafePublicUrl('gopher://example.com').isValid).toBe(false);
  });
});
