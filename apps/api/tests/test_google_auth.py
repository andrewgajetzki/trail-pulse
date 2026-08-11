import os
import unittest
from unittest.mock import patch

from app.google_auth import GoogleTokenValidationError, verify_google_id_token


class GoogleTokenVerificationTests(unittest.TestCase):
    def setUp(self) -> None:
        os.environ["GOOGLE_CLIENT_ID"] = "trail-pulse-client-id.apps.googleusercontent.com"

    @patch("app.google_auth.id_token.verify_oauth2_token")
    def test_verifies_with_the_configured_google_client_id(self, verify_token) -> None:
        verify_token.return_value = {
            "sub": "google-subject",
            "iss": "https://accounts.google.com",
        }

        claims = verify_google_id_token("google-id-token")

        self.assertEqual(claims["sub"], "google-subject")
        self.assertEqual(
            verify_token.call_args.args[2],
            os.environ["GOOGLE_CLIENT_ID"],
        )

    @patch("app.google_auth.id_token.verify_oauth2_token")
    def test_rejects_an_untrusted_issuer(self, verify_token) -> None:
        verify_token.return_value = {"iss": "https://untrusted.example"}

        with self.assertRaises(GoogleTokenValidationError):
            verify_google_id_token("google-id-token")
