"""
Test suite for Decision Maker Extractor.
Tests structured team card extraction, text pattern detection,
confidence scoring, profile link extraction, and zero-hallucination guarantees.
"""

import unittest
from extractors.decision_maker_extractor import decision_maker_extractor


class TestDecisionMakerExtractor(unittest.TestCase):

    def test_structured_team_card_extraction(self):
        """Test extraction from standard HTML team cards with name, role, LinkedIn, and mailto."""
        html = """
        <html>
        <body>
          <div class="team-container">
            <div class="team-member">
              <h3 class="name">Sarah Connor</h3>
              <p class="role">Chief Executive Officer</p>
              <a href="https://www.linkedin.com/in/sarah-connor-ceo">LinkedIn</a>
              <a href="mailto:s.connor@acmetech.com">Email Sarah</a>
            </div>
            <div class="team-card">
              <h4>Marcus Vance</h4>
              <span class="position">Co-Founder & Head of Operations</span>
              <p>Marcus oversees all logistics operations.</p>
            </div>
            <div class="team-card">
              <h4>Elena Rostova</h4>
              <span class="title">Lead Graphic Designer</span>
            </div>
          </div>
        </body>
        </html>
        """
        pages = {
            "team": {
                "url": "https://acmetech.com/team",
                "html": html,
                "text": "Sarah Connor Chief Executive Officer Marcus Vance Co-Founder Elena Rostova Lead Graphic Designer",
            }
        }

        dms = decision_maker_extractor.extract(pages, company_name="Acme Tech")

        # Sarah Connor should be identified as CEO
        sarah = next((d for d in dms if d["fullName"] == "Sarah Connor"), None)
        self.assertIsNotNone(sarah, "Sarah Connor should be extracted")
        self.assertEqual(sarah["jobTitle"], "Chief Executive Officer")
        self.assertEqual(sarah["professionalProfileUrl"], "https://www.linkedin.com/in/sarah-connor-ceo")
        self.assertEqual(sarah["publicBusinessEmail"], "s.connor@acmetech.com")
        self.assertEqual(sarah["confidence"], "high")
        self.assertIn("Chief Executive Officer", sarah["evidence"])

        # Marcus Vance should be identified as Co-Founder or Head of Operations
        marcus = next((d for d in dms if d["fullName"] == "Marcus Vance"), None)
        self.assertIsNotNone(marcus, "Marcus Vance should be extracted")
        self.assertIn(marcus["jobTitle"], ["Co-Founder", "Head of Operations"])
        self.assertEqual(marcus["confidence"], "high")

        # Elena Rostova is a Graphic Designer (not a decision maker) -> MUST be excluded!
        elena = next((d for d in dms if d["fullName"] == "Elena Rostova"), None)
        self.assertIsNone(elena, "Non-decision-maker (Graphic Designer) must NOT be extracted")

    def test_text_pattern_extraction(self):
        """Test extraction from inline text patterns on About page."""
        html = """
        <html>
        <body>
          <section class="about-section">
            <h2>About Our Leadership</h2>
            <p>Founded in 2018 by Robert Sterling, Managing Director of Global Logistics.</p>
            <p>Our sales efforts are spearheaded by Diana Prince - Sales Director.</p>
          </section>
        </body>
        </html>
        """
        pages = {
            "about": {
                "url": "https://globallogistics.com/about-us",
                "html": html,
                "text": "About Our Leadership Founded by Robert Sterling, Managing Director. Diana Prince - Sales Director.",
            }
        }

        dms = decision_maker_extractor.extract(pages, company_name="Global Logistics")
        names = [d["fullName"] for d in dms]
        self.assertIn("Robert Sterling", names)
        self.assertIn("Diana Prince", names)

        robert = next(d for d in dms if d["fullName"] == "Robert Sterling")
        self.assertEqual(robert["jobTitle"], "Managing Director")
        self.assertEqual(robert["sourceUrl"], "https://globallogistics.com/about-us")

    def test_anti_hallucination_and_blacklist_filtering(self):
        """Ensure common UI strings and navigation headings are never returned as people."""
        html = """
        <html>
        <body>
          <div class="team-card">
            <h3>Our Team</h3>
            <p class="role">Chief Executive Officer</p>
          </div>
          <div class="team-card">
            <h3>Leadership Team</h3>
            <p class="role">Managing Director</p>
          </div>
          <div class="team-card">
            <h3>Read More</h3>
            <p class="role">Founder</p>
          </div>
        </body>
        </html>
        """
        pages = {
            "home": {
                "url": "https://example.com",
                "html": html,
                "text": "Our Team Leadership Team Read More",
            }
        }

        dms = decision_maker_extractor.extract(pages)
        self.assertEqual(len(dms), 0, "Blacklisted navigation strings must never be extracted as people")

    def test_no_decision_makers_returns_empty_list(self):
        """Ensure that when no verifiable decision-makers exist, empty list is returned without inventing any."""
        html = """
        <html>
        <body>
          <h1>Welcome to Widget World</h1>
          <p>We sell quality widgets worldwide. Call us at 555-1234.</p>
        </body>
        </html>
        """
        pages = {
            "home": {
                "url": "https://widgetworld.com",
                "html": html,
                "text": "Welcome to Widget World We sell quality widgets worldwide.",
            }
        }

        dms = decision_maker_extractor.extract(pages)
        self.assertEqual(dms, [], "Must return empty list when no decision maker evidence is present")


if __name__ == "__main__":
    unittest.main()

