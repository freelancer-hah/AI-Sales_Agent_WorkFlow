"""
Decision-Maker Extractor for AI-Powered Company Lead Generation.
Discovers and extracts company leadership (CEOs, Founders, Directors, Managers)
from official company team and leadership pages, adhering to strict zero-hallucination rules.
"""

import re
from typing import Dict, List, Any, Optional, Set
from urllib.parse import urlparse
from bs4 import BeautifulSoup, Tag

# Target decision maker positions to identify
TARGET_ROLES = [
    # C-Level & Founders
    (re.compile(r"\b(?:Chief\s+Executive\s+Officer|CEO)\b", re.I), "Chief Executive Officer"),
    (re.compile(r"\b(?:Co-Founder|Co-Founding)\b", re.I), "Co-Founder"),
    (re.compile(r"\b(?:Founder)\b", re.I), "Founder"),
    (re.compile(r"\b(?:Co-Owner)\b", re.I), "Co-Owner"),
    (re.compile(r"\b(?:Owner|Proprietor)\b", re.I), "Owner"),
    (re.compile(r"\b(?:Managing\s+Director|MD)\b", re.I), "Managing Director"),
    (re.compile(r"\b(?:Executive\s+President|President)\b", re.I), "President"),
    (re.compile(r"\b(?:Vice\s+President|VP)\b", re.I), "Vice President"),
    # Operations
    (re.compile(r"\b(?:Chief\s+Operating\s+Officer|COO)\b", re.I), "Chief Operating Officer"),
    (re.compile(r"\b(?:Operations\s+Director|Director\s+of\s+Operations)\b", re.I), "Director of Operations"),
    (re.compile(r"\b(?:Head\s+of\s+Operations)\b", re.I), "Head of Operations"),
    (re.compile(r"\b(?:Operations\s+Manager)\b", re.I), "Operations Manager"),
    # Sales & Revenue
    (re.compile(r"\b(?:Chief\s+Revenue\s+Officer|CRO)\b", re.I), "Chief Revenue Officer"),
    (re.compile(r"\b(?:Sales\s+Director|Director\s+of\s+Sales)\b", re.I), "Sales Director"),
    (re.compile(r"\b(?:Head\s+of\s+Sales)\b", re.I), "Head of Sales"),
    (re.compile(r"\b(?:VP\s+(?:of\s+)?Sales)\b", re.I), "VP of Sales"),
    # Business Development
    (re.compile(r"\b(?:Business\s+Development\s+Director|Director\s+of\s+Business\s+Development)\b", re.I), "Business Development Director"),
    (re.compile(r"\b(?:Head\s+of\s+Business\s+Development)\b", re.I), "Head of Business Development"),
    (re.compile(r"\b(?:VP\s+(?:of\s+)?Business\s+Development)\b", re.I), "VP of Business Development"),
]

# Words that should NEVER be considered valid person names
BLACKLIST_NAMES = {
    "our team", "leadership team", "about us", "contact us", "join our team",
    "board of directors", "our story", "our mission", "executive team", "careers",
    "read more", "learn more", "view bio", "view profile", "follow us", "get in touch",
    "send message", "click here", "terms of service", "privacy policy", "company overview",
    "press release", "news", "services", "solutions", "all rights reserved",
    "management team", "advisory board", "meet the team", "who we are", "what we do",
    "case study", "customer service", "support team", "cookie policy", "terms and conditions",
    "phone number", "email address", "office location", "headquarters", "global presence"
}

# Regex to validate human name structure (2 to 4 capitalized words)
NAME_REGEX = re.compile(
    r"^(?:(?:Dr\.|Mr\.|Mrs\.|Ms\.|Prof\.)\s+)?[A-Z][a-z]+(?:-[A-Z][a-z]+)?(?:\s+[A-Z]\.?)?(?:\s+[A-Z][a-z]+(?:-[A-Z][a-z]+)?){1,2}$"
)

# Regex to find LinkedIn or public professional profile
PROFILE_REGEX = re.compile(
    r"https?://(?:www\.)?linkedin\.com/in/[a-zA-Z0-9_\-%]+|https?://(?:www\.)?twitter\.com/[a-zA-Z0-9_]+|https?://(?:www\.)?x\.com/[a-zA-Z0-9_]+",
    re.I
)

# Mailto regex
MAILTO_REGEX = re.compile(r"mailto:([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})", re.I)


class DecisionMakerExtractor:
    """Discovers and parses decision-makers from crawled company website pages."""

    def match_target_role(self, text: str) -> Optional[str]:
        """Check if the given text matches any of our target leadership roles."""
        if not text:
            return None
        clean_text = " ".join(text.split())
        for regex, canonical in TARGET_ROLES:
            if regex.search(clean_text):
                # Return the matching portion or canonical title
                return canonical
        return None

    def is_valid_name(self, name: str) -> bool:
        """Validate that the extracted name is a genuine human name."""
        if not name:
            return False
        clean = " ".join(name.strip().split())
        if len(clean) < 4 or len(clean) > 40:
            return False

        if clean.lower() in BLACKLIST_NAMES:
            return False

        # Check if words in name contain obvious web UI terms
        words = clean.split()
        if len(words) < 2 or len(words) > 4:
            return False

        for w in words:
            if w.lower() in ("and", "the", "with", "for", "our", "team", "view", "bio", "read", "more", "learn"):
                return False

        return bool(NAME_REGEX.match(clean))

    def clean_name(self, name: str) -> str:
        """Strip titles, credentials, and extraneous formatting."""
        clean = " ".join(name.strip().split())
        # Remove trailing comma or punctuation
        clean = re.sub(r"[,;:\-–|]+$", "", clean).strip()
        # Remove common trailing degree titles
        clean = re.sub(r",?\s*(?:PhD|MD|MBA|Esq\.|M\.S\.|B\.S\.)$", "", clean, flags=re.I).strip()
        return clean

    def extract(
        self,
        pages: Dict[str, Dict[str, str]],
        company_name: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        Extracts decision makers from crawled pages.
        Pages prioritizes: 'team', 'about', 'home'.
        """
        discovered: Dict[str, Dict[str, Any]] = {}

        # Prioritize pages in order of likelihood
        page_priority = ["team", "about", "home"]
        sorted_keys = [k for k in page_priority if k in pages] + [k for k in pages if k not in page_priority]

        for p_key in sorted_keys:
            page_data = pages[p_key]
            page_url = page_data.get("url", "")
            page_html = page_data.get("html", "")
            if not page_html:
                continue

            soup = BeautifulSoup(page_html, "html.parser")

            # Strategy 1: Look for structured team/card elements
            card_dms = self._extract_from_cards(soup, page_url, p_key, company_name)
            for dm in card_dms:
                norm_name = dm["fullName"].lower()
                if norm_name not in discovered:
                    discovered[norm_name] = dm
                else:
                    self._merge_dm(discovered[norm_name], dm)

            # Strategy 2: Look for heading + paragraph or text pattern pairings
            pattern_dms = self._extract_from_patterns(soup, page_url, p_key, company_name)
            for dm in pattern_dms:
                norm_name = dm["fullName"].lower()
                if norm_name not in discovered:
                    discovered[norm_name] = dm
                else:
                    self._merge_dm(discovered[norm_name], dm)

        return list(discovered.values())

    def _extract_from_cards(
        self,
        soup: BeautifulSoup,
        page_url: str,
        page_type: str,
        company_name: Optional[str]
    ) -> List[Dict[str, Any]]:
        """Extracts decision makers from container tags commonly used for team member cards."""
        results: List[Dict[str, Any]] = []

        card_selectors = [
            {"class_": re.compile(r"(?:team-member|team_member|team-card|member-card|person-card|executive|leader|leadership|bio-card|profile-card|staff-member)", re.I)},
            {"class_": re.compile(r"\b(?:member|person|profile|bio)\b", re.I)},
        ]

        candidate_containers: List[Tag] = []
        for selector in card_selectors:
            found = soup.find_all(["div", "article", "li", "section"], **selector)
            for el in found:
                if el not in candidate_containers:
                    candidate_containers.append(el)

        for container in candidate_containers:
            # 1. Look for name
            name = None
            name_tag = container.find(["h2", "h3", "h4", "h5", "strong"])
            if not name_tag:
                name_tag = container.find(class_=re.compile(r"(?:name|title-name|author)", re.I))

            if name_tag:
                raw_name = name_tag.get_text()
                cleaned = self.clean_name(raw_name)
                if self.is_valid_name(cleaned):
                    name = cleaned

            if not name:
                continue

            # 2. Look for role / title
            role = None
            role_tag = container.find(class_=re.compile(r"(?:role|title|position|designation|job)", re.I))
            if role_tag:
                role = self.match_target_role(role_tag.get_text())

            if not role:
                # Look in sibling paragraphs
                for p in container.find_all(["p", "span", "div"]):
                    if p != name_tag and not p.find(name_tag):
                        matched = self.match_target_role(p.get_text())
                        if matched:
                            role = matched
                            break

            if not role:
                continue

            # 3. Look for professional profile URL
            profile_url = ""
            for a in container.find_all("a", href=True):
                href = a["href"].strip()
                if PROFILE_REGEX.match(href):
                    profile_url = href
                    break

            # 4. Look for direct public business email inside card
            email = ""
            for a in container.find_all("a", href=True):
                href = a["href"].strip()
                mailto_match = MAILTO_REGEX.search(href)
                if mailto_match:
                    found_email = mailto_match.group(1).lower()
                    if not any(found_email.endswith(ext) for ext in [".png", ".jpg", ".webp"]):
                        email = found_email
                        break

            # 5. Extract supporting evidence
            container_text = " ".join(container.get_text().split())
            evidence = container_text[:160]

            confidence = "high" if (page_type == "team" or profile_url) else "medium"

            results.append({
                "fullName": name,
                "jobTitle": role,
                "companyName": company_name or "",
                "professionalProfileUrl": profile_url,
                "publicBusinessEmail": email,
                "evidence": f"{name} identified as {role} from official team profile. ({evidence})",
                "sourceUrl": page_url,
                "confidence": confidence,
                "discoveryStatus": "identified",
            })

        return results

    def _extract_from_patterns(
        self,
        soup: BeautifulSoup,
        page_url: str,
        page_type: str,
        company_name: Optional[str]
    ) -> List[Dict[str, Any]]:
        """Finds decision makers mentioned via text patterns in headings and paragraphs."""
        results: List[Dict[str, Any]] = []

        # Pattern: [Name], [Role] OR [Role]: [Name]
        text_blocks = []
        for tag in soup.find_all(["p", "li", "h2", "h3", "h4", "h5", "div"]):
            # Skip tags with lots of children
            if len(tag.find_all()) > 4:
                continue
            text = " ".join(tag.get_text().split())
            if 15 <= len(text) <= 200:
                text_blocks.append((text, tag))

        # Common leadership regex patterns without applying re.I to the name capture
        # 1. "Jane Doe, CEO and Founder" or "Jane Doe - Managing Director"
        pattern1 = re.compile(
            r"\b(?P<name>[A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2})\b\s*[,–\-:|]\s*(?P<title>(?i:Chief\s+Executive\s+Officer|CEO|Co-Founder|Founder|Managing\s+Director|President|Owner|Operations\s+Manager|Head\s+of\s+Operations|COO|Sales\s+Director|Head\s+of\s+Sales|Business\s+Development\s+Director)[^.\n,;]{0,50})"
        )

        # 2. "CEO: Jane Doe" or "Founder & CEO Jane Doe"
        pattern2 = re.compile(
            r"(?P<title>(?i:Chief\s+Executive\s+Officer|CEO|Co-Founder|Founder|Managing\s+Director|President|Owner|Operations\s+Manager|Head\s+of\s+Operations|COO|Sales\s+Director|Head\s+of\s+Sales|Business\s+Development\s+Director))\s*[:–\-|,]?\s*\b(?P<name>[A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2})\b"
        )

        for text, tag in text_blocks:
            for pat in [pattern1, pattern2]:
                match = pat.search(text)
                if match:
                    raw_name = match.group("name")
                    raw_title = match.group("title")

                    cleaned_name = self.clean_name(raw_name)
                    if not self.is_valid_name(cleaned_name):
                        continue

                    matched_role = self.match_target_role(raw_title)
                    if not matched_role:
                        continue

                    # Look for profile or email in parent
                    profile_url = ""
                    email = ""
                    parent = tag.parent
                    if parent:
                        for a in parent.find_all("a", href=True):
                            href = a["href"].strip()
                            if not profile_url and PROFILE_REGEX.match(href):
                                profile_url = href
                            if not email:
                                m = MAILTO_REGEX.search(href)
                                if m:
                                    email = m.group(1).lower()

                    confidence = "high" if page_type == "team" else "medium"

                    results.append({
                        "fullName": cleaned_name,
                        "jobTitle": matched_role,
                        "companyName": company_name or "",
                        "professionalProfileUrl": profile_url,
                        "publicBusinessEmail": email,
                        "evidence": f"Found leadership mention: \"{text}\"",
                        "sourceUrl": page_url,
                        "confidence": confidence,
                        "discoveryStatus": "identified",
                    })

        return results

    def _merge_dm(self, target: Dict[str, Any], source: Dict[str, Any]) -> None:
        """Merges two records for the same decision maker to retain the best data."""
        if not target.get("professionalProfileUrl") and source.get("professionalProfileUrl"):
            target["professionalProfileUrl"] = source["professionalProfileUrl"]

        if not target.get("publicBusinessEmail") and source.get("publicBusinessEmail"):
            target["publicBusinessEmail"] = source["publicBusinessEmail"]

        # Upgrade confidence if source is higher
        if source.get("confidence") == "high":
            target["confidence"] = "high"

        if source.get("sourceUrl") and "team" in source["sourceUrl"]:
            target["sourceUrl"] = source["sourceUrl"]
            target["evidence"] = source["evidence"]


decision_maker_extractor = DecisionMakerExtractor()
