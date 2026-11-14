"""
Unit tests for Python scraping extractors and SSRF URL protection.
"""

import unittest
from crawler.polite_crawler import is_safe_public_url
from extractors.contact_extractor import contact_extractor
from extractors.company_extractor import company_extractor


class TestScraperExtractors(unittest.TestCase):
    def test_ssrf_url_protection(self):
        # Legitimate public URLs must pass
        self.assertTrue(is_safe_public_url("https://example.com"))
        self.assertTrue(is_safe_public_url("http://google.com/contact"))

        # Localhost and loopback must be rejected
        self.assertFalse(is_safe_public_url("http://localhost:8000"))
        self.assertFalse(is_safe_public_url("http://127.0.0.1:5000"))
        self.assertFalse(is_safe_public_url("http://internal.local"))

        # Private IP addresses must be rejected
        self.assertFalse(is_safe_public_url("http://192.168.1.1/admin"))
        self.assertFalse(is_safe_public_url("http://10.0.0.5:8080"))
        self.assertFalse(is_safe_public_url("http://172.16.0.1"))

    def test_contact_extractor_emails_and_filtering(self):
        mock_html = """
        <html>
            <body>
                <header>
                    <img src="logo@2x.png" alt="Logo" />
                    <a href="mailto:contact@acmerobotics.com">Email Us</a>
                </header>
                <div>
                    Support us at info@acmerobotics.com or reach out via phone: +1-555-0199.
                    Ignore tracker errors at errors@sentry.io and image file test@hero.jpg.
                </div>
                <footer>
                    <a href="tel:+1-555-0199">Call Support</a>
                </footer>
            </body>
        </html>
        """
        pages = {
            "home": {
                "url": "https://acmerobotics.com",
                "html": mock_html,
                "text": "Email Us Support us at info@acmerobotics.com or reach out via phone: +1-555-0199. Ignore tracker errors at errors@sentry.io and image file test@hero.jpg. Call Support",
            }
        }

        result = contact_extractor.extract(pages)
        emails = result["emails"]
        phones = result["phoneNumbers"]

        self.assertIn("contact@acmerobotics.com", emails)
        self.assertIn("info@acmerobotics.com", emails)
        # Verify false-positives are rejected!
        self.assertNotIn("logo@2x.png", emails)
        self.assertNotIn("test@hero.jpg", emails)
        self.assertNotIn("errors@sentry.io", emails)

        # Verify phone extraction
        self.assertTrue(any("555-0199" in p for p in phones))

    def test_company_size_extractor(self):
        sample_text_small = "Founded in 2018, we are a passionate team of 25 engineers building robotics."
        cat_small, meta_small = company_extractor.extract_company_size(sample_text_small, "https://example.com/about")
        self.assertEqual(cat_small, "Small: 1–50 employees")
        self.assertIsNotNone(meta_small)

        sample_text_med = "With over 120 employees worldwide, Apex delivers logistics solutions across 40 countries."
        cat_med, meta_med = company_extractor.extract_company_size(sample_text_med, "https://example.com/about")
        self.assertEqual(cat_med, "Medium: 51–250 employees")

        sample_unknown = "We are an innovative enterprise software company."
        cat_unk, meta_unk = company_extractor.extract_company_size(sample_unknown, "https://example.com/about")
        self.assertEqual(cat_unk, "Unknown")
        self.assertIsNone(meta_unk)

    def test_company_description_and_services(self):
        mock_about_html = """
        <html>
            <body>
                <h1>About Us</h1>
                <p>Apex Solutions is an industry-leading provider of autonomous warehouse robots and automated fulfillment systems for global retailers.</p>
                <h3>Our Core Solutions</h3>
                <ul>
                    <li>Automated Material Handling</li>
                    <li>Predictive Maintenance Analytics</li>
                    <li>Robotic Sorting Systems</li>
                </ul>
            </body>
        </html>
        """
        pages = {
            "about": {
                "url": "https://apex.example.com/about",
                "html": mock_about_html,
                "text": "About Us Apex Solutions is an industry-leading provider of autonomous warehouse robots. Automated Material Handling Predictive Maintenance Analytics Robotic Sorting Systems",
            }
        }

        desc, source_url = company_extractor.extract_description(pages)
        self.assertIn("Apex Solutions is an industry-leading provider", desc)
        self.assertEqual(source_url, "https://apex.example.com/about")

        services = company_extractor.extract_services(pages)
        service_names = [s["service"] for s in services]
        self.assertTrue(any("Automated Material Handling" in s or "Analytics" in s for s in service_names))


if __name__ == "__main__":
    unittest.main()

