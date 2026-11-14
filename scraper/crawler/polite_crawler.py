"""
Polite Web Crawler with robots.txt compliance, SSRF protection,
and targeted internal page discovery.
"""

import re
import ipaddress
import socket
from urllib.parse import urlparse, urljoin
from urllib.robotparser import RobotFileParser
from typing import Dict, List, Set, Optional
import httpx
from bs4 import BeautifulSoup

USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"

# Internal page category keywords
RELEVANT_PATTERNS = {
    "about": re.compile(r"/(about|about-us|company|who-we-are|our-story|overview)/?", re.I),
    "contact": re.compile(r"/(contact|contact-us|reach-us|get-in-touch|support)/?", re.I),
    "services": re.compile(r"/(services|our-services|solutions|what-we-do|capabilities|products)/?", re.I),
    "team": re.compile(r"/(team|leadership|management|our-team|people|board-of-directors|executives)/?", re.I),
}

def is_safe_public_url(url: str) -> bool:
    """Validate that the URL targets a safe public IP address to prevent SSRF."""
    try:
        parsed = urlparse(url)
        if parsed.scheme not in ("http", "https"):
            return False
        hostname = parsed.hostname
        if not hostname:
            return False

        hostname_lower = hostname.lower()
        if (
            hostname_lower in ("localhost", "127.0.0.1", "::1")
            or hostname_lower.endswith(".localhost")
            or hostname_lower.endswith(".local")
            or hostname_lower.endswith(".internal")
        ):
            return False

        # Check IP ranges
        try:
            ip = ipaddress.ip_address(hostname)
            if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_reserved or ip.is_multicast:
                return False
        except ValueError:
            # Domain name, resolve to check target IP
            try:
                addr_info = socket.getaddrinfo(hostname, None)
                for entry in addr_info:
                    ip = ipaddress.ip_address(entry[4][0])
                    if ip.is_private or ip.is_loopback or ip.is_link_local:
                        return False
            except Exception:
                pass

        return True
    except Exception:
        return False


class PoliteCrawler:
    def __init__(self, timeout: float = 8.0, max_pages: int = 5):
        self.timeout = timeout
        self.max_pages = max_pages
        self.headers = {
            "User-Agent": USER_AGENT,
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.5",
        }

    async def check_robots_allowed(self, client: httpx.AsyncClient, target_url: str) -> bool:
        """Fetch and evaluate robots.txt for the given target."""
        try:
            parsed = urlparse(target_url)
            robots_url = f"{parsed.scheme}://{parsed.netloc}/robots.txt"
            res = await client.get(robots_url, timeout=3.0)
            if res.status_code == 200:
                parser = RobotFileParser()
                parser.parse(res.text.splitlines())
                return parser.can_fetch(USER_AGENT, target_url)
            return True
        except Exception:
            # If robots.txt cannot be fetched or does not exist, assume allowed by convention
            return True

    def find_relevant_links(self, base_url: str, html: str) -> Dict[str, str]:
        """Discover priority internal pages (about, contact, services, team) from HTML."""
        discovered: Dict[str, str] = {}
        soup = BeautifulSoup(html, "html.parser")
        parsed_base = urlparse(base_url)
        base_domain = parsed_base.netloc.lower()

        for a_tag in soup.find_all("a", href=True):
            href = a_tag["href"].strip()
            if not href or href.startswith(("#", "javascript:", "mailto:", "tel:")):
                continue

            full_url = urljoin(base_url, href)
            parsed_href = urlparse(full_url)

            # Ensure same origin domain
            if parsed_href.netloc.lower() != base_domain:
                continue

            path = parsed_href.path.lower()
            text = (a_tag.get_text() or "").lower()

            for category, pattern in RELEVANT_PATTERNS.items():
                if category not in discovered:
                    if pattern.search(path) or pattern.search(text):
                        discovered[category] = full_url

        return discovered

    async def crawl_site(self, base_url: str) -> Dict[str, Dict[str, str]]:
        """
        Crawls the homepage and up to 4 priority internal pages.
        Returns mapping of: { page_type: { "url": str, "html": str, "text": str } }
        """
        if not is_safe_public_url(base_url):
            raise ValueError(f"Blocked unsafe or private URL: {base_url}")

        results: Dict[str, Dict[str, str]] = {}

        async with httpx.AsyncClient(headers=self.headers, follow_redirects=True, timeout=self.timeout, verify=False) as client:
            # 1. Check robots.txt
            allowed = await self.check_robots_allowed(client, base_url)
            if not allowed:
                return results

            # 2. Fetch homepage
            try:
                resp = await client.get(base_url)
                if resp.status_code != 200:
                    return results

                home_html = resp.text
                home_soup = BeautifulSoup(home_html, "html.parser")

                # Remove non-content elements
                for element in home_soup(["script", "style", "noscript", "svg"]):
                    element.extract()

                results["home"] = {
                    "url": str(resp.url),
                    "html": home_html,
                    "text": home_soup.get_text(separator=" ", strip=True),
                }

                # 3. Find relevant internal pages
                internal_links = self.find_relevant_links(str(resp.url), home_html)

                # Check for canonical or og:url pointing to an alternate brand domain (e.g. .com vs .pk)
                canonical_soup = BeautifulSoup(home_html, "html.parser")
                canonical_link = canonical_soup.find("link", rel=lambda r: r and "canonical" in str(r).lower())
                og_link = canonical_soup.find("meta", property=lambda p: p and "og:url" in str(p).lower())

                alt_origins = []
                for candidate_tag in [canonical_link, og_link]:
                    if candidate_tag:
                        c_href = candidate_tag.get("href") or candidate_tag.get("content")
                        if c_href and isinstance(c_href, str) and c_href.startswith("http"):
                            try:
                                parsed_c = urlparse(c_href)
                                if parsed_c.netloc and parsed_c.netloc.lower() != urlparse(base_url).netloc.lower():
                                    alt_origins.append(f"{parsed_c.scheme}://{parsed_c.netloc}")
                            except Exception:
                                pass

                # If priority pages not found in raw static links (common in SPAs like Next.js/React), add standard candidate URLs
                fallback_candidates = []
                base_clean = str(resp.url).rstrip("/")
                if "contact" not in internal_links:
                    fallback_candidates.append(("contact", f"{base_clean}/contact-us"))
                    fallback_candidates.append(("contact", f"{base_clean}/contact"))
                if "about" not in internal_links:
                    fallback_candidates.append(("about", f"{base_clean}/about-us"))
                    fallback_candidates.append(("about", f"{base_clean}/about"))

                for alt_origin in alt_origins:
                    fallback_candidates.append(("contact", f"{alt_origin}/contact-us"))
                    fallback_candidates.append(("contact", f"{alt_origin}/contact"))
                    fallback_candidates.append(("about", f"{alt_origin}/about-us"))

                # 4. Fetch up to max_pages
                crawled_urls = {str(resp.url)}
                candidates_to_crawl = list(internal_links.items()) + fallback_candidates
                for page_type, link_url in candidates_to_crawl:
                    if len(results) >= self.max_pages:
                        break
                    if link_url in crawled_urls:
                        continue
                    crawled_urls.add(link_url)

                    try:
                        page_resp = await client.get(link_url)
                        if page_resp.status_code == 200:
                            page_html = page_resp.text
                            page_soup = BeautifulSoup(page_html, "html.parser")
                            for element in page_soup(["script", "style", "noscript", "svg"]):
                                element.extract()

                            results[page_type] = {
                                "url": str(page_resp.url),
                                "html": page_html,
                                "text": page_soup.get_text(separator=" ", strip=True),
                            }
                    except Exception:
                        continue

            except Exception as e:
                pass

        return results

