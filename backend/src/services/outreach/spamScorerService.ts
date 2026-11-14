export interface SpamAnalysisResult {
  spamScore: number; // 0 - 100 (0 = pristine, 100 = extreme spam risk)
  spamFlags: string[];
  isHighRisk: boolean;
  recommendations: string[];
}

export class SpamScorerService {
  private highRiskPhrases: string[] = [
    '100% free',
    'act now',
    'instant cash',
    'risk-free',
    'risk free',
    'no catch',
    'pure profit',
    'make money',
    'earn $',
    'fast cash',
    'order now',
    'click here',
    'limited time',
    'urgent',
    'winner',
    'congratulations',
    'miracle',
    'double your',
    'satisfaction guaranteed',
    'guaranteed refund',
  ];

  private mediumRiskWords: string[] = [
    'free',
    'guarantee',
    'guaranteed',
    'discount',
    'save big',
    'unlimited',
    'lowest price',
    'buy direct',
    'cheap',
    'claim now',
  ];

  private allowedAbbreviations: Set<string> = new Set([
    'AI',
    'B2B',
    'B2C',
    'CRM',
    'ERP',
    'API',
    'CTO',
    'CEO',
    'COO',
    'CFO',
    'ROI',
    'SaaS',
    'LLM',
    'ML',
    'IT',
    'USA',
    'UK',
    'EU',
    'HTML',
    'CSS',
    'SMTP',
    'IMAP',
    'RFC',
  ]);

  /**
   * Evaluates subject and body text for deliverability risks, spam trigger words,
   * excessive capitalization, exclamation punctuation, and unsubscribe footer compliance.
   */
  public analyze(subject: string, bodyText: string, hasOptOutFooter: boolean = true): SpamAnalysisResult {
    let score = 0;
    const flags: string[] = [];
    const recommendations: string[] = [];

    const normalizedSubject = (subject || '').toLowerCase();
    const normalizedBody = (bodyText || '').toLowerCase();
    const fullText = `${normalizedSubject} ${normalizedBody}`;

    // 1. High-risk spam trigger phrases (+20 per hit)
    for (const phrase of this.highRiskPhrases) {
      if (fullText.includes(phrase)) {
        score += 20;
        flags.push(`High-risk spam phrase detected: "${phrase}"`);
        recommendations.push(`Remove promotional phrase "${phrase}". Use consultative business language instead.`);
      }
    }

    // 2. Medium-risk spam trigger words (+8 per hit, max 32)
    let mediumRiskHits = 0;
    for (const word of this.mediumRiskWords) {
      const regex = new RegExp(`\\b${word}\\b`, 'i');
      if (regex.test(fullText)) {
        mediumRiskHits++;
        if (mediumRiskHits <= 4) {
          score += 8;
          flags.push(`Spam trigger word detected: "${word}"`);
        }
      }
    }
    if (mediumRiskHits > 0) {
      recommendations.push('Reduce promotional adjectives such as "free", "guaranteed", or "discount".');
    }

    // 3. Exclamation marks
    if (subject.includes('!')) {
      score += 25;
      flags.push('Exclamation mark (!) in subject line');
      recommendations.push('Never use exclamation marks in B2B cold email subject lines.');
    }

    const bodyExclamationCount = (bodyText.match(/!/g) || []).length;
    if (bodyExclamationCount > 2) {
      score += 15;
      flags.push(`Excessive exclamation marks in body (${bodyExclamationCount})`);
      recommendations.push('Keep email body calm and conversational. Avoid using multiple exclamation points.');
    } else if (bodyExclamationCount > 1) {
      score += 5;
    }

    // 4. Currency symbols in subject ($$$)
    if (/[\$£€]/.test(subject)) {
      score += 20;
      flags.push('Currency symbol in subject line');
      recommendations.push('Avoid currency symbols in cold subject lines.');
    }

    // 5. ALL-CAPS words detection
    const words = `${subject} ${bodyText}`.split(/\s+/);
    let allCapsCount = 0;
    for (const word of words) {
      const cleaned = word.replace(/[^a-zA-Z]/g, '');
      if (cleaned.length >= 3 && cleaned === cleaned.toUpperCase() && !this.allowedAbbreviations.has(cleaned)) {
        allCapsCount++;
      }
    }

    if (allCapsCount >= 3) {
      score += 20;
      flags.push(`High volume of ALL-CAPS words (${allCapsCount})`);
      recommendations.push('Avoid SHOUTING in emails. Convert ALL-CAPS words to standard casing.');
    } else if (allCapsCount >= 1) {
      score += 8;
      flags.push(`ALL-CAPS word detected (${allCapsCount})`);
    }

    // 6. Subject line length
    if (subject.length > 70) {
      score += 10;
      flags.push(`Subject line is overly long (${subject.length} characters)`);
      recommendations.push('Shorten subject line to under 50 characters for optimal open rates.');
    }

    // 7. Mandatory opt-out / unsubscribe presence
    if (!hasOptOutFooter && !normalizedBody.includes('unsubscribe') && !normalizedBody.includes('opt out')) {
      score += 25;
      flags.push('Missing explicit unsubscribe / opt-out notice');
      recommendations.push('Ensure an opt-out link and physical postal address are included in the footer (CAN-SPAM / GDPR).');
    }

    // Cap score at 100
    const finalScore = Math.min(100, Math.max(0, score));

    return {
      spamScore: finalScore,
      spamFlags: flags,
      isHighRisk: finalScore >= 40,
      recommendations: Array.from(new Set(recommendations)),
    };
  }
}

export const spamScorerService = new SpamScorerService();

