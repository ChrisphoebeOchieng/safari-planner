"""Automated API tests for Safari Planner."""

import unittest

from app import create_app
from app.extensions import db
from app.models import Role, User, TripPreference


class TestConfig:
    """Isolated configuration for automated tests."""

    TESTING = True
    SQLALCHEMY_DATABASE_URI = "sqlite://"
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SECRET_KEY = "test-secret"
    JWT_SECRET_KEY = "test-jwt-secret"
    JWT_ACCESS_TOKEN_EXPIRES = False
    FRONTEND_ORIGIN = "http://localhost:5173"


class SafariPlannerAPITests(unittest.TestCase):

    def setUp(self):
        self.app = create_app(TestConfig)
        self.client = self.app.test_client()

        self.app_context = self.app.app_context()
        self.app_context.push()

        db.create_all()

        db.session.add_all([
            Role(name="traveler", description="Test traveler"),
            Role(name="admin", description="Test administrator"),
            Role(name="agency", description="Test agency"),
        ])
        db.session.commit()

    def tearDown(self):
        db.session.remove()
        db.drop_all()
        self.app_context.pop()

    def register_user(self, name, email):
        return self.client.post(
            "/api/auth/register",
            json={
                "full_name": name,
                "email": email,
                "password": "StrongPass123",
            },
        )

    def login_user(self, email):
        response = self.client.post(
            "/api/auth/login",
            json={
                "email": email,
                "password": "StrongPass123",
            },
        )
        return response.get_json()["access_token"]

    def auth_headers(self, token):
        return {"Authorization": f"Bearer {token}"}

    def create_user_trip(self, token):
        preference_response = self.client.post(
            "/api/trip-preferences",
            headers=self.auth_headers(token),
            json={
                "destination": "Maasai Mara",
                "start_date": "2030-08-10",
                "end_date": "2030-08-12",
                "travel_style": "Wildlife & Safari",
                "budget": 50000,
            },
        )

        self.assertEqual(preference_response.status_code, 201)

        preference_id = preference_response.get_json()["preference"]["id"]

        itinerary_response = self.client.post(
            f"/api/trip-preferences/{preference_id}/generate",
            headers=self.auth_headers(token),
        )

        self.assertEqual(itinerary_response.status_code, 201)

        return itinerary_response.get_json()["itinerary_id"]

    # ---------------------------------------------------------
    # Authentication tests
    # ---------------------------------------------------------

    def test_register_user(self):
        response = self.register_user("Test Traveler", "traveler@example.com")

        self.assertEqual(response.status_code, 201)
        self.assertIn("access_token", response.get_json())
        self.assertEqual(
            response.get_json()["user"]["email"],
            "traveler@example.com",
        )

    def test_register_duplicate_email(self):
        self.register_user("First Traveler", "traveler@example.com")

        response = self.register_user(
            "Second Traveler",
            "TRAVELER@example.com",
        )

        self.assertEqual(response.status_code, 409)

    def test_register_rejects_short_password(self):
        response = self.client.post(
            "/api/auth/register",
            json={
                "full_name": "Test Traveler",
                "email": "short@example.com",
                "password": "123",
            },
        )

        self.assertEqual(response.status_code, 400)

    def test_login_success(self):
        self.register_user("Test Traveler", "traveler@example.com")

        response = self.client.post(
            "/api/auth/login",
            json={
                "email": "TRAVELER@example.com",
                "password": "StrongPass123",
            },
        )

        self.assertEqual(response.status_code, 200)
        self.assertIn("access_token", response.get_json())

    def test_login_rejects_wrong_password(self):
        self.register_user("Test Traveler", "traveler@example.com")

        response = self.client.post(
            "/api/auth/login",
            json={
                "email": "traveler@example.com",
                "password": "WrongPassword",
            },
        )

        self.assertEqual(response.status_code, 401)

    def test_current_user_requires_authentication(self):
        response = self.client.get("/api/auth/me")

        self.assertEqual(response.status_code, 401)

    def test_current_user_returns_authenticated_account(self):
        self.register_user("Test Traveler", "traveler@example.com")
        token = self.login_user("traveler@example.com")

        response = self.client.get(
            "/api/auth/me",
            headers=self.auth_headers(token),
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.get_json()["user"]["full_name"],
            "Test Traveler",
        )

    def test_logout_revokes_token(self):
        self.register_user("Test Traveler", "traveler@example.com")
        token = self.login_user("traveler@example.com")
        headers = self.auth_headers(token)

        logout_response = self.client.post(
            "/api/auth/logout",
            headers=headers,
        )

        self.assertEqual(logout_response.status_code, 200)

        protected_response = self.client.get(
            "/api/auth/me",
            headers=headers,
        )

        self.assertEqual(protected_response.status_code, 401)

    # ---------------------------------------------------------
    # Trip preference tests
    # ---------------------------------------------------------

    def test_guest_can_create_trip_preferences(self):
        response = self.client.post(
            "/api/trip-preferences",
            json={
                "destination": "Diani",
                "start_date": "2030-06-01",
                "end_date": "2030-06-04",
                "travel_style": "Coastal Escape",
                "budget": 30000,
            },
        )

        self.assertEqual(response.status_code, 201)

        preference_id = response.get_json()["preference"]["id"]
        preference = db.session.get(TripPreference, preference_id)

        self.assertIsNone(preference.user_id)
        self.assertTrue(response.get_json()["guest_access_token"])
        self.assertEqual(
            len(preference.guest_access_token_hash), 64
        )
        self.assertNotEqual(
            preference.guest_access_token_hash,
            response.get_json()["guest_access_token"],
        )

    def create_guest_trip(self):
        preference_response = self.client.post(
            "/api/trip-preferences",
            json={
                "destination": "Diani",
                "start_date": "2030-06-01",
                "end_date": "2030-06-03",
                "travel_style": "Coastal Escape",
                "budget": 30000,
            },
        )
        self.assertEqual(preference_response.status_code, 201)
        result = preference_response.get_json()
        return result["preference"]["id"], result["guest_access_token"]

    def test_guest_cannot_generate_without_access_token(self):
        preference_id, token = self.create_guest_trip()
        response = self.client.post(
            f"/api/trip-preferences/{preference_id}/generate"
        )
        self.assertEqual(response.status_code, 404)

    def test_guest_can_generate_with_own_access_token(self):
        preference_id, token = self.create_guest_trip()
        response = self.client.post(
            f"/api/trip-preferences/{preference_id}/generate",
            headers={"X-Guest-Access-Token": token},
        )
        self.assertEqual(response.status_code, 201)

    def test_guest_cannot_use_another_guests_token(self):
        first_id, first_token = self.create_guest_trip()
        second_id, second_token = self.create_guest_trip()
        response = self.client.post(
            f"/api/trip-preferences/{second_id}/generate",
            headers={"X-Guest-Access-Token": first_token},
        )
        self.assertEqual(response.status_code, 404)

    def test_guest_cannot_update_without_access_token(self):
        preference_id, token = self.create_guest_trip()
        response = self.client.put(
            f"/api/trip-preferences/{preference_id}",
            json={
                "destination": "Diani",
                "start_date": "2030-06-01",
                "end_date": "2030-06-04",
                "travel_style": "Coastal Escape",
                "budget": 35000,
            },
        )
        self.assertEqual(response.status_code, 404)

    def test_guest_can_update_with_own_access_token(self):
        preference_id, token = self.create_guest_trip()
        response = self.client.put(
            f"/api/trip-preferences/{preference_id}",
            headers={"X-Guest-Access-Token": token},
            json={
                "destination": "Diani",
                "start_date": "2030-06-01",
                "end_date": "2030-06-04",
                "travel_style": "Coastal Escape",
                "budget": 35000,
            },
        )
        self.assertEqual(response.status_code, 200)

    def test_trip_preferences_reject_invalid_dates(self):
        response = self.client.post(
            "/api/trip-preferences",
            json={
                "destination": "Diani",
                "start_date": "invalid-date",
                "end_date": "2030-06-04",
                "travel_style": "Coastal Escape",
            },
        )

        self.assertEqual(response.status_code, 400)

    def test_trip_preferences_reject_end_date_before_start(self):
        response = self.client.post(
            "/api/trip-preferences",
            json={
                "destination": "Diani",
                "start_date": "2030-06-10",
                "end_date": "2030-06-01",
                "travel_style": "Coastal Escape",
            },
        )

        self.assertEqual(response.status_code, 400)

    # ---------------------------------------------------------
    # Itinerary ownership tests
    # ---------------------------------------------------------

    def test_itinerary_list_requires_authentication(self):
        response = self.client.get("/api/itineraries")

        self.assertEqual(response.status_code, 401)

    def test_user_can_view_own_itinerary(self):
        self.register_user("Owner", "owner@example.com")
        token = self.login_user("owner@example.com")

        itinerary_id = self.create_user_trip(token)

        response = self.client.get(
            f"/api/itineraries/{itinerary_id}",
            headers=self.auth_headers(token),
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.get_json()["itinerary_id"],
            itinerary_id,
        )

    def test_user_cannot_view_another_users_itinerary(self):
        self.register_user("Owner", "owner@example.com")
        self.register_user("Other User", "other@example.com")

        owner_token = self.login_user("owner@example.com")
        other_token = self.login_user("other@example.com")

        itinerary_id = self.create_user_trip(owner_token)

        response = self.client.get(
            f"/api/itineraries/{itinerary_id}",
            headers=self.auth_headers(other_token),
        )

        self.assertEqual(response.status_code, 404)

    def test_user_only_sees_own_itineraries(self):
        self.register_user("Owner", "owner@example.com")
        self.register_user("Other User", "other@example.com")

        owner_token = self.login_user("owner@example.com")
        other_token = self.login_user("other@example.com")

        self.create_user_trip(owner_token)

        response = self.client.get(
            "/api/itineraries",
            headers=self.auth_headers(other_token),
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json()["count"], 0)

    def test_user_cannot_delete_another_users_itinerary(self):
        self.register_user("Owner", "owner@example.com")
        self.register_user("Other User", "other@example.com")

        owner_token = self.login_user("owner@example.com")
        other_token = self.login_user("other@example.com")

        itinerary_id = self.create_user_trip(owner_token)

        response = self.client.delete(
            f"/api/itineraries/{itinerary_id}",
            headers=self.auth_headers(other_token),
        )

        self.assertEqual(response.status_code, 404)

    def test_owner_can_delete_own_itinerary(self):
        self.register_user("Owner", "owner@example.com")
        token = self.login_user("owner@example.com")

        itinerary_id = self.create_user_trip(token)

        response = self.client.delete(
            f"/api/itineraries/{itinerary_id}",
            headers=self.auth_headers(token),
        )

        self.assertEqual(response.status_code, 200)

    def test_user_cannot_update_another_users_preferences(self):
        self.register_user("Owner", "owner@example.com")
        self.register_user("Other User", "other@example.com")

        owner_token = self.login_user("owner@example.com")
        other_token = self.login_user("other@example.com")

        preference_response = self.client.post(
            "/api/trip-preferences",
            headers=self.auth_headers(owner_token),
            json={
                "destination": "Maasai Mara",
                "start_date": "2030-08-10",
                "end_date": "2030-08-12",
                "travel_style": "Wildlife & Safari",
            },
        )

        preference_id = preference_response.get_json()["preference"]["id"]

        response = self.client.put(
            f"/api/trip-preferences/{preference_id}",
            headers=self.auth_headers(other_token),
            json={
                "destination": "Diani",
                "start_date": "2030-09-10",
                "end_date": "2030-09-12",
                "travel_style": "Coastal Escape",
            },
        )

        self.assertEqual(response.status_code, 404)


if __name__ == "__main__":
    unittest.main()
