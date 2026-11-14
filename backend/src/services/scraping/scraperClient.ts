import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';
import { ISource } from '../../models/Source.js';
import { IJobPosting } from '../../models/Company.js';
import { isSafePublicUrl } from '../../utils/urlValidator.js';
import { cleanEmail, cleanPhoneNumber } from '../../utils/normalizer.js';

export interface ScrapedDecisionMaker {
  fullName: string;
  jobTitle: string;
  professionalProfileUrl?: string;
  publicBusinessEmail?: string;
  evidence?: string;
  sourceUrl?: string;
  confidence: 'high' | 'medium' | 'low';
  discoveryStatus?: 'identified' | 'verified' | 'unverified';
}

export interface ScrapedCompanyData {
  url: string;
  description?: string;
  services: string[];
  products: string[];
  emails: string[];
  phoneNumbers: string[];
  contactPageUrl?: string;
  hasContactForm?: boolean;
  companySize?: 'Small: 1–50 employees' | 'Medium: 51–250 employees' | 'Large: 251–1000 employees' | 'Enterprise: 1000+ employees' | 'Unknown';
  socialLinks?: {
    linkedin?: string;
    twitter?: string;
    facebook?: string;
    github?: string;
  };
  decisionMakers?: ScrapedDecisionMaker[];
  sources: ISource[];
}

export class ScraperClient {
  private serviceUrl: string;

  constructor() {
    this.serviceUrl = env.SCRAPER_SERVICE_URL || 'http://localhost:8000';
  }

  public async scrapeWebsite(url: string): Promise<ScrapedCompanyData> {
    const safeCheck = isSafePublicUrl(url);
    if (!safeCheck.isValid) {
      throw new Error(`SSRF Prevention: Cannot scrape unsafe target URL (${safeCheck.reason})`);
    }

    try {
      logger.info(`Sending scrape request to Python Scraper service: ${url}`);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 20000); // 20s timeout

      const response = await fetch(`${this.serviceUrl}/scrape`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, max_pages: 5 }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const body: any = await response.json();
        if (body.success && body.data) {
          logger.info(`Python scraper successfully processed ${url}`);
          return body.data;
        }
      }

      logger.warn(`Python scraper returned non-success for ${url}. Executing resilient fallback crawler...`);
    } catch (err: any) {
      logger.warn(`Python scraper service unavailable at ${this.serviceUrl} (${err.message}). Using resilient direct fallback crawler...`);
    }

    // Resilient fallback direct HTTP crawler in Node.js
    return this.fallbackCrawl(url);
  }

  /**
   * Scrapes active job postings from LinkedIn, Indeed, Glassdoor, and Google Jobs using JobSpy
   */
  public async scrapeCompanyJobs(
    companyName: string,
    location?: string,
    country?: string
  ): Promise<IJobPosting[]> {
    try {
      logger.info(`Sending JobSpy job scraping request for company: "${companyName}" (Location: "${location || 'any'}", Country: "${country || 'any'}")`);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 35000); // 35s timeout for concurrent job boards

      const response = await fetch(`${this.serviceUrl}/scrape-jobs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company_name: companyName,
          location: location || '',
          country: country || '',
          results_wanted: 15,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const body: any = await response.json();
        if (body.success && Array.isArray(body.jobs)) {
          logger.info(`JobSpy found ${body.jobs.length} jobs for "${companyName}"`);
          return body.jobs.map((j: any) => ({
            title: String(j.title || 'Role').trim(),
            platform: String(j.platform || 'job_board').trim(),
            company: String(j.company || companyName).trim(),
            location: String(j.location || '').trim(),
            salary: String(j.salary || '').trim(),
            datePosted: String(j.datePosted || '').trim(),
            jobUrl: String(j.jobUrl || '').trim(),
            descriptionSnippet: String(j.descriptionSnippet || '').trim(),
          }));
        }
      }

      logger.warn(`JobSpy returned empty or non-success for "${companyName}"`);
      return [];
    } catch (err: any) {
      logger.warn(`JobSpy scraping service unavailable or timed out for "${companyName}": ${err.message}`);
      return [];
    }
  }

  private decodeCloudflareEmail(hex: string): string {
    try {
      let email = '';
      const key = parseInt(hex.substring(0, 2), 16);
      for (let n = 2; n < hex.length; n += 2) {
        email += String.fromCharCode(parseInt(hex.substring(n, 2), 16) ^ key);
      }
      return email.trim().toLowerCase();
    } catch {
      return '';
    }
  }

  private isValidExtractedEmail(email: string): boolean {
    if (!email || typeof email !== 'string') return false;
    const lower = email.trim().toLowerCase();
    if (lower.length < 6 || lower.length > 80) return false;
    if (!/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i.test(lower)) return false;

    const invalidExtensions = [
      '.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.css', '.js',
      '.map', '.ico', '.woff', '.woff2', '.mp4', '.pdf'
    ];
    if (invalidExtensions.some((ext) => lower.endsWith(ext))) return false;

    const ignoreDomains = [
      'sentry.io', 'w3.org', 'schema.org', 'github.com', 'example.com',
      'domain.com', 'bootstrap.com', 'cloudflare.com', 'wixpress.com',
      'google.com', 'facebook.com', 'twitter.com', 'instagram.com', 'youtube.com'
    ];
    if (ignoreDomains.some((domain) => lower.includes(domain))) return false;

    const fillerPrefixes = ['email@', 'name@', 'yourname@', 'test@', 'user@', 'username@', 'info@example'];
    if (fillerPrefixes.some((p) => lower.startsWith(p))) return false;

    return true;
  }

  private async fallbackCrawl(url: string): Promise<ScrapedCompanyData> {
    const defaultHeaders = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
    };

    let html = '';
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(url, {
        headers: defaultHeaders,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      if (response.ok) {
        html = await response.text();
      }
    } catch (err: any) {
      logger.warn(`Fallback fetch failed for homepage ${url}: ${err.message}`);
    }

    const sources: ISource[] = [];
    const emails: string[] = [];
    const phoneNumbers: string[] = [];

    // Helper to extract contacts from an HTML string
    const extractContactsFromHtml = (pageHtml: string, pageUrl: string, pageType: string) => {
      // 1. Cloudflare protected emails (data-cfemail)
      const cfMatches = Array.from(pageHtml.matchAll(/data-cfemail=["']([a-f0-9]{4,})["']/gi));
      for (const match of cfMatches) {
        const decoded = this.decodeCloudflareEmail(match[1]);
        if (this.isValidExtractedEmail(decoded) && !emails.includes(decoded)) {
          emails.push(decoded);
          sources.push({
            sourceUrl: pageUrl,
            sourceType: pageType as any,
            extractedField: 'email',
            supportingText: `Found Cloudflare-decoded email: ${decoded}`,
            fetchedAt: new Date(),
          });
        }
      }

      // 2. Mailto links
      const mailtoMatches = Array.from(pageHtml.matchAll(/mailto:([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})/gi));
      for (const match of mailtoMatches) {
        const email = cleanEmail(match[1]);
        if (this.isValidExtractedEmail(email) && !emails.includes(email)) {
          emails.push(email);
          sources.push({
            sourceUrl: pageUrl,
            sourceType: pageType as any,
            extractedField: 'email',
            supportingText: `Found mailto link: ${email}`,
            fetchedAt: new Date(),
          });
        }
      }

      // 3. Raw text & footer table emails (captures raw text emails e.g. on UET footer)
      const rawEmailMatches = Array.from(pageHtml.matchAll(/\b([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})\b/gi));
      for (const match of rawEmailMatches) {
        const email = cleanEmail(match[1]);
        if (this.isValidExtractedEmail(email) && !emails.includes(email)) {
          emails.push(email);
          sources.push({
            sourceUrl: pageUrl,
            sourceType: pageType as any,
            extractedField: 'email',
            supportingText: `Extracted public email from ${pageType}: ${email}`,
            fetchedAt: new Date(),
          });
        }
      }

      // 4. Tel links
      const telMatches = Array.from(pageHtml.matchAll(/tel:([+\d\s().-]{7,25})/gi));
      for (const match of telMatches) {
        const phone = cleanPhoneNumber(match[1]);
        if (phone && phone.replace(/\D/g, '').length >= 7 && !phoneNumbers.includes(phone)) {
          phoneNumbers.push(phone);
          sources.push({
            sourceUrl: pageUrl,
            sourceType: pageType as any,
            extractedField: 'phone',
            supportingText: `Found tel link: ${phone}`,
            fetchedAt: new Date(),
          });
        }
      }

      // 5. Raw phone text matching (international + local Pakistan / general format)
      const rawPhoneMatches = Array.from(pageHtml.matchAll(/(?:\+92|0092|\+1|\+44|0)[0-9\s().-]{8,20}\b/g));
      for (const match of rawPhoneMatches) {
        const clean = cleanPhoneNumber(match[0]);
        const digits = clean.replace(/\D/g, '');
        if (digits.length >= 8 && digits.length <= 16 && !phoneNumbers.includes(clean)) {
          phoneNumbers.push(clean);
          sources.push({
            sourceUrl: pageUrl,
            sourceType: pageType as any,
            extractedField: 'phone',
            supportingText: `Extracted phone from ${pageType}: ${clean}`,
            fetchedAt: new Date(),
          });
        }
      }
    };

    if (html) {
      extractContactsFromHtml(html, url, 'website_home');

      // Check for contact / about page links on homepage to crawl deeper
      const contactLinkMatch = html.match(/href=["']([^"']*(?:contact|contact-us|reach-us|about-us)[^"']*)["']/i);
      if (contactLinkMatch && contactLinkMatch[1]) {
        try {
          const resolvedContactUrl = new URL(contactLinkMatch[1], url).href;
          if (resolvedContactUrl !== url && isSafePublicUrl(resolvedContactUrl).isValid) {
            const contactCtrl = new AbortController();
            const contactTimeout = setTimeout(() => contactCtrl.abort(), 6000);
            const contactRes = await fetch(resolvedContactUrl, {
              headers: defaultHeaders,
              signal: contactCtrl.signal,
            });
            clearTimeout(contactTimeout);
            if (contactRes.ok) {
              const contactHtml = await contactRes.text();
              extractContactsFromHtml(contactHtml, resolvedContactUrl, 'website_contact');
            }
          }
        } catch {
          // Subpage fetch error ignored
        }
      }
    }

    // 1. Description via meta tag regex
    let description = '';
    if (html) {
      const metaDescMatch = html.match(/<meta[^>]+(?:name|property)=["'](?:description|og:description)["'][^>]+content=["']([^"']+)["']/i);
      if (metaDescMatch && metaDescMatch[1]) {
        description = metaDescMatch[1].trim();
        sources.push({
          sourceUrl: url,
          sourceType: 'website_home',
          extractedField: 'description',
          supportingText: 'Extracted meta description from homepage',
          fetchedAt: new Date(),
        });
      }
    }

    // 4. Social media handles
    const socialLinks: any = {};
    if (html) {
      const linkedinMatch = html.match(/href=["'](https?:\/\/(?:www\.)?linkedin\.com\/(?:company|school)\/[^"']+)["']/i);
      if (linkedinMatch) socialLinks.linkedin = linkedinMatch[1];

      const twitterMatch = html.match(/href=["'](https?:\/\/(?:www\.)?(?:twitter|x)\.com\/[^"']+)["']/i);
      if (twitterMatch) socialLinks.twitter = twitterMatch[1];
    }

    // 5. Decision maker identification in fallback crawler
    const decisionMakers: ScrapedDecisionMaker[] = [];
    const seenNames = new Set<string>();

    const roleRegex = /\b(Vice\s+Chancellor|Dean|Registrar|Chief\s+Executive\s+Officer|CEO|Co-Founder|Founder|Managing\s+Director|President|Owner|Operations\s+Manager|Head\s+of\s+Operations|COO|Sales\s+Director|Head\s+of\s+Sales|Director|Principal)\b/i;
    const blacklist = new Set([
      'our team', 'leadership team', 'about us', 'contact us', 'join us',
      'read more', 'learn more', 'press release', 'news article', 'view bio',
      'terms of service', 'privacy policy'
    ]);

    if (html) {
      // Check for team member cards or blocks in HTML
      const cardRegex = /<(?:div|article|li)[^>]*class=["'][^"']*(?:team|member|leader|executive|person|faculty)[^"']*["'][^>]*>([\s\S]*?)<\/(?:div|article|li)>/gi;
      const cardMatches = Array.from(html.matchAll(cardRegex));

      for (const cMatch of cardMatches) {
        const cardHtml = cMatch[1];
        const nameMatch = cardHtml.match(/<h[2-5][^>]*>([^<]+)<\/h[2-5]>/i) ||
                          cardHtml.match(/<strong[^>]*>([^<]+)<\/strong>/i) ||
                          cardHtml.match(/class=["'][^"']*name[^"']*["'][^>]*>([^<]+)<\//i);

        if (nameMatch) {
          const rawName = nameMatch[1].replace(/&[a-z]+;/g, ' ').trim();
          const lowerName = rawName.toLowerCase();
          if (
            !blacklist.has(lowerName) &&
            /^[A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3}$/.test(rawName) &&
            !seenNames.has(lowerName)
          ) {
            const roleMatch = cardHtml.match(roleRegex);
            if (roleMatch) {
              const role = roleMatch[0].trim();
              seenNames.add(lowerName);

              // Check for profile URL
              const profMatch = cardHtml.match(/href=["'](https?:\/\/(?:www\.)?linkedin\.com\/in\/[^"']+)["']/i);
              const mailMatch = cardHtml.match(/mailto:([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})/i);

              const dmItem: ScrapedDecisionMaker = {
                fullName: rawName,
                jobTitle: role,
                professionalProfileUrl: profMatch ? profMatch[1] : '',
                publicBusinessEmail: mailMatch ? cleanEmail(mailMatch[1]) : '',
                evidence: `${rawName} identified as ${role} from team profile`,
                sourceUrl: url,
                confidence: profMatch ? 'high' : 'medium',
                discoveryStatus: 'identified',
              };

              decisionMakers.push(dmItem);
              sources.push({
                sourceUrl: url,
                sourceType: 'website_team',
                extractedField: 'decision_maker',
                supportingText: `${rawName} (${role})`,
                fetchedAt: new Date(),
              });
            }
          }
        }
      }

      // Also check text pattern matches in overall HTML
      const patternRegex1 = /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3})\b\s*[,–\-|:]\s*(Vice\s+Chancellor|Dean|Registrar|Chief\s+Executive\s+Officer|CEO|Co-Founder|Founder|Managing\s+Director|President|Owner|Operations\s+Manager|Head\s+of\s+Operations|COO|Sales\s+Director|Head\s+of\s+Sales|Director|Principal)/g;
      const pat1Matches = Array.from(html.matchAll(patternRegex1));
      for (const match of pat1Matches) {
        const rawName = match[1].trim();
        const role = match[2].trim();
        const lowerName = rawName.toLowerCase();
        if (!blacklist.has(lowerName) && !seenNames.has(lowerName)) {
          seenNames.add(lowerName);
          decisionMakers.push({
            fullName: rawName,
            jobTitle: role,
            evidence: `Found mention: ${match[0]}`,
            sourceUrl: url,
            confidence: 'medium',
            discoveryStatus: 'identified',
          });
          sources.push({
            sourceUrl: url,
            sourceType: 'website_about',
            extractedField: 'decision_maker',
            supportingText: `${rawName} (${role})`,
            fetchedAt: new Date(),
          });
        }
      }
    }

    return {
      url,
      description,
      services: [],
      products: [],
      emails,
      phoneNumbers,
      companySize: 'Unknown',
      socialLinks,
      decisionMakers,
      sources,
    };
  }
}

export const scraperClient = new ScraperClient();
