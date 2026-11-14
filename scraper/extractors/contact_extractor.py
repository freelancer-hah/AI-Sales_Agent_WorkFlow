"""
Extractor for public business contacts: emails, phone numbers,
and contact forms. Strictly rejects invalid formats and image-based false-positives.
"""

import re
from typing import Dict, List, Set, Tuple
from bs4 import BeautifulSoup

EMAIL_REGEX = re.compile(
    r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b"
)

# Reject image extensions, tracking scripts, and placeholders
INVALID_EMAIL_EXTENSIONS = (
    ".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp",
    ".css", ".js", ".map", ".ico", ".woff", ".woff2"
)
IGNORE_DOMAINS = (
    "example.com", "domain.com", "yourdomain.com", "sentry.io",
    "wixpress.com", "w3.org", "schema.org", "github.com",
    "bootstrap.com", "google.com", "facebook.com"
)

# International & national phone number regex
PHONE_REGEX = re.compile(
    r"(?:(?:\+?1\s*(?:[.-]\s*)?)?(?:\(\s*([2-9]1[02-9]|[2-9][02-8]1|[2-9][02-8][02-9])\s*\)|([2-9]1[02-9]|[2-9][02-8]1|[2-9][02-8][02-9]))\s*(?:[.-]\s*)?)?([2-9]1[02-9]|[2-9][02-9]1|[2-9][02-9]{2})\s*(?:[.-]\s*)?([0-9]{4})(?:\s*(?:#|x\.?|ext\.?|extension)\s*(\d+))?",
    re.I
)
INTL_PHONE_REGEX = re.compile(
    r"\+(?:[0-9] ?){6,14}[0-9]"
)


class ContactExtractor:
    def is_valid_business_email(self, email: str) -> bool:
        lower = email.lower().strip()
        if any(lower.endswith(ext) for ext in INVALID_EMAIL_EXTENSIONS):
            return False
        if any(domain in lower for domain in IGNORE_DOMAINS):
            return False
        if len(lower) < 6 or len(lower) > 80:
            return False
        # Ignore common filler names
        if lower.startswith(("email@", "name@", "user@", "username@")):
            return False
        return True

    def extract(self, pages: Dict[str, Dict[str, str]]) -> Dict[str, any]:
        """
        Extracts public emails and phones across crawled pages.
        Returns:
          {
            "emails": List[str],
            "phoneNumbers": List[str],
            "contactPageUrl": Optional[str],
            "hasContactForm": bool,
            "sources": List[Dict]
          }
        """
        emails: Set[str] = set()
        phones: Set[str] = set()
        sources: List[Dict[str, any]] = []
        contact_page_url = None
        has_contact_form = False

        for page_type, page_data in pages.items():
            url = page_data["url"]
            html = page_data["html"]
            text = page_data["text"]
            soup = BeautifulSoup(html, "html.parser")

            if page_type == "contact" and not contact_page_url:
                contact_page_url = url

            # 1. Check for contact form
            forms = soup.find_all("form")
            if forms and page_type in ("contact", "home"):
                has_contact_form = True

            # 2. Extract Cloudflare protected emails (data-cfemail)
            for cf_tag in soup.find_all(attrs={"data-cfemail": True}):
                try:
                    cf_hex = cf_tag["data-cfemail"]
                    key = int(cf_hex[:2], 16)
                    decoded = "".join(chr(int(cf_hex[i:i+2], 16) ^ key) for i in range(2, len(cf_hex), 2)).strip().lower()
                    if self.is_valid_business_email(decoded) and decoded not in emails:
                        emails.add(decoded)
                        sources.append({
                            "sourceUrl": url,
                            "sourceType": f"website_{page_type}",
                            "extractedField": "email",
                            "supportingText": f"Decoded Cloudflare email: {decoded}",
                        })
                except Exception:
                    pass

            # 3. Extract mailto: links
            for a_tag in soup.find_all("a", href=True):
                href = a_tag["href"].strip()
                if href.lower().startswith("mailto:"):
                    clean_mail = href[7:].split("?")[0].strip().lower()
                    if self.is_valid_business_email(clean_mail):
                        if clean_mail not in emails:
                            emails.add(clean_mail)
                            sources.append({
                                "sourceUrl": url,
                                "sourceType": f"website_{page_type}",
                                "extractedField": "email",
                                "supportingText": f"Found mailto link: {clean_mail}",
                            })

                elif href.lower().startswith("tel:"):
                    clean_tel = href[4:].split("?")[0].strip()
                    # Strip non-digits except +
                    digits = re.sub(r"[^\d+]", "", clean_tel)
                    if 7 <= len(digits) <= 16 and clean_tel not in phones:
                        phones.add(clean_tel)
                        sources.append({
                            "sourceUrl": url,
                            "sourceType": f"website_{page_type}",
                            "extractedField": "phone",
                            "supportingText": f"Found tel link: {clean_tel}",
                        })

            # 4. Extract emails from visible text & raw HTML (covers footer tables, spans, lists)
            combined_content = f"{text} {html}"
            text_matches = EMAIL_REGEX.findall(combined_content)
            for raw_mail in text_matches:
                clean_mail = raw_mail.strip().lower()
                if self.is_valid_business_email(clean_mail) and clean_mail not in emails:
                    emails.add(clean_mail)
                    sources.append({
                        "sourceUrl": url,
                        "sourceType": f"website_{page_type}",
                        "extractedField": "email",
                        "supportingText": f"Public email listed on {page_type} page.",
                    })

            # 5. Extract phones from visible text (prioritize contact page or footer)
            intl_matches = INTL_PHONE_REGEX.findall(text)
            for raw_phone in intl_matches:
                p = raw_phone.strip()
                if 8 <= len(re.sub(r"\D", "", p)) <= 16 and p not in phones:
                    phones.add(p)
                    sources.append({
                        "sourceUrl": url,
                        "sourceType": f"website_{page_type}",
                        "extractedField": "phone",
                        "supportingText": f"Phone number listed on {page_type} page: {p}",
                    })

            # Local / regional phone numbers (e.g. 042-99029227 or (042) 99029227)
            local_phone_regex = re.compile(r"(?:0092|0|\+92)[ -]?(?:[0-9]{2,4})[ -]?[0-9]{6,8}")
            for m in local_phone_regex.findall(text):
                p_clean = m.strip()
                if p_clean not in phones:
                    phones.add(p_clean)
                    sources.append({
                        "sourceUrl": url,
                        "sourceType": f"website_{page_type}",
                        "extractedField": "phone",
                        "supportingText": f"Phone number listed on {page_type} page: {p_clean}",
                    })

        return {
            "emails": list(emails),
            "phoneNumbers": list(phones),
            "contactPageUrl": contact_page_url,
            "hasContactForm": has_contact_form,
            "sources": sources,
        }


contact_extractor = ContactExtractor()

