"""
Extractor for company profile, business description, services,
products, company size evidence, and social media handles.
"""

import re
from typing import Dict, List, Set, Optional, Any, Tuple
from bs4 import BeautifulSoup


class CompanyExtractor:
    def extract_description(self, pages: Dict[str, Dict[str, str]]) -> Tuple[str, Optional[str]]:
        """
        Extracts company description.
        Prioritizes:
        1. About page lead paragraph
        2. Homepage meta description / og:description
        3. Homepage first meaningful paragraph
        Returns: (description_text, source_url)
        """
        # Check About page first
        if "about" in pages:
            soup = BeautifulSoup(pages["about"]["html"], "html.parser")
            paragraphs = soup.find_all("p")
            for p in paragraphs:
                text = p.get_text(strip=True)
                if 50 < len(text) < 400 and not any(w in text.lower() for w in ("cookie", "privacy policy", "copyright")):
                    return text, pages["about"]["url"]

        # Check Home page meta description
        if "home" in pages:
            soup = BeautifulSoup(pages["home"]["html"], "html.parser")
            meta_desc = soup.find("meta", attrs={"name": "description"}) or soup.find("meta", attrs={"property": "og:description"})
            if meta_desc and meta_desc.get("content"):
                desc = meta_desc["content"].strip()
                if len(desc) > 30:
                    return desc, pages["home"]["url"]

            # Fallback: Home page paragraph
            for p in soup.find_all("p"):
                text = p.get_text(strip=True)
                if 50 < len(text) < 300:
                    return text, pages["home"]["url"]

        return "", None

    def extract_services(self, pages: Dict[str, Dict[str, str]]) -> List[Dict[str, str]]:
        """
        Extracts distinct services and capabilities.
        Returns: [ { "service": str, "sourceUrl": str } ]
        """
        services: List[Dict[str, str]] = []
        seen = set()

        target_pages = [p for p in ("services", "home", "about") if p in pages]

        for p_name in target_pages:
            soup = BeautifulSoup(pages[p_name]["html"], "html.parser")
            url = pages[p_name]["url"]

            # Search in service sections or cards
            candidate_elements = soup.find_all(["h3", "h4", "li"])
            for el in candidate_elements:
                text = el.get_text(strip=True)
                # Reasonable service phrase length (10 to 60 characters)
                if 5 <= len(text) <= 50 and not any(c in text for c in ("\n", "$", "©", "http")):
                    lower = text.lower()
                    if any(w in lower for w in ("service", "solution", "management", "consulting", "development", "analytics", "cloud", "automation", "design", "security", "engineering")):
                        if lower not in seen:
                            seen.add(lower)
                            services.append({"service": text, "sourceUrl": url})
                            if len(services) >= 10:
                                break

        return services

    def extract_company_size(self, text: str, source_url: str) -> Tuple[str, Optional[Dict[str, any]]]:
        """
        Scans text for explicit team size mentions.
        Categorizes according to prompt requirements:
        - Small: 1–50 employees
        - Medium: 51–250 employees
        - Large: 251–1000 employees
        - Enterprise: 1000+ employees
        - Unknown
        """
        # Patterns like: "team of 45", "over 150 employees", "200+ professionals"
        size_patterns = [
            (re.compile(r"\b(team\s+of|over|more\s+than|employs|staff\s+of)\s+(\d{1,5})\+?\s+(employees|people|professionals|engineers|specialists)?\b", re.I), 2),
            (re.compile(r"\b(\d{1,5})\+?\s+(employees|staff|team\s+members)\b", re.I), 1),
        ]

        for pattern, group_idx in size_patterns:
            match = pattern.search(text)
            if match:
                try:
                    count = int(match.group(group_idx))
                    evidence = match.group(0)

                    category = "Unknown"
                    if 1 <= count <= 50:
                        category = "Small: 1–50 employees"
                    elif 51 <= count <= 250:
                        category = "Medium: 51–250 employees"
                    elif 251 <= count <= 1000:
                        category = "Large: 251–1000 employees"
                    elif count > 1000:
                        category = "Enterprise: 1000+ employees"

                    if category != "Unknown":
                        source_meta = {
                            "sourceUrl": source_url,
                            "sourceType": "website_about",
                            "extractedField": "companySize",
                            "supportingText": f'Found explicit mention: "{evidence}"',
                        }
                        return category, source_meta
                except Exception:
                    pass

        return "Unknown", None

    def extract_social_links(self, pages: Dict[str, Dict[str, str]]) -> Dict[str, str]:
        """Extracts official company social links from any page (footer/header)."""
        socials = {
            "linkedin": "",
            "twitter": "",
            "facebook": "",
            "github": "",
        }

        for page_data in pages.values():
            soup = BeautifulSoup(page_data["html"], "html.parser")
            for a in soup.find_all("a", href=True):
                href = a["href"].strip()
                if "linkedin.com/company/" in href and not socials["linkedin"]:
                    socials["linkedin"] = href
                elif ("twitter.com/" in href or "x.com/" in href) and not socials["twitter"]:
                    if not any(w in href for w in ("share", "intent", "search")):
                        socials["twitter"] = href
                elif "facebook.com/" in href and not socials["facebook"]:
                    if not any(w in href for w in ("share", "dialog")):
                        socials["facebook"] = href
                elif "github.com/" in href and not socials["github"]:
                    socials["github"] = href

        return socials


from typing import Tuple
company_extractor = CompanyExtractor()
