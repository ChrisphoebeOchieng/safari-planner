"""Automated API tests for Safari Planner."""

import unittest

from sqlalchemy import select
from decimal import Decimal

from app import create_app
from app.extensions import db
from app.models import Role, User, TripPreference, TransportOption


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


class TransportAPITests(unittest.TestCase):
    """Tests for public transport comparison."""

    def setUp(self):
        self.app = create_app(TestConfig)
        self.client = self.app.test_client()
        self.app_context = self.app.app_context()
        self.app_context.push()

        db.create_all()

        db.session.add_all([
            TransportOption(
                transport_type="sgr",
                provider="Kenya Railways",
                origin="Nairobi",
                destination="Mombasa",
                estimated_fare=Decimal("1500.00"),
                duration_minutes=300,
                departure_time="08:00",
                arrival_time="13:00",
                is_active=True,
            ),
            TransportOption(
                transport_type="bus",
                provider="Example Bus",
                origin="Nairobi",
                destination="Mombasa",
                estimated_fare=Decimal("1800.00"),
                duration_minutes=540,
                is_active=True,
            ),
            TransportOption(
                transport_type="flight",
                provider="Example Airline",
                origin="Nairobi",
                destination="Mombasa",
                estimated_fare=Decimal("8500.00"),
                duration_minutes=75,
                is_active=True,
            ),
            TransportOption(
                transport_type="bus",
                provider="Inactive Bus",
                origin="Nairobi",
                destination="Kisumu",
                estimated_fare=Decimal("1200.00"),
                duration_minutes=420,
                is_active=False,
            ),
        ])
        db.session.commit()

    def tearDown(self):
        db.session.remove()
        db.drop_all()
        self.app_context.pop()

    def test_transport_options_are_returned(self):
        response = self.client.get("/api/transport")

        self.assertEqual(response.status_code, 200)
        data = response.get_json()
        self.assertEqual(data["count"], 3)
        self.assertEqual(
            data["transport_options"][0]["currency"],
            "KES",
        )
        self.assertEqual(
            data["transport_options"][0]["fare_type"],
            "indicative",
        )
        self.assertIn("disclaimer", data)

    def test_transport_can_be_filtered_by_type(self):
        response = self.client.get("/api/transport?type=sgr")

        self.assertEqual(response.status_code, 200)
        options = response.get_json()["transport_options"]
        self.assertEqual(len(options), 1)
        self.assertEqual(options[0]["transport_type"], "sgr")

    def test_transport_can_be_filtered_by_route(self):
        response = self.client.get(
            "/api/transport?origin=nairobi&destination=mombasa"
        )

        self.assertEqual(response.status_code, 200)
        options = response.get_json()["transport_options"]
        self.assertEqual(len(options), 3)

    def test_transport_can_be_sorted_by_fare(self):
        response = self.client.get("/api/transport?sort_by=fare")

        options = response.get_json()["transport_options"]
        fares = [Decimal(item["estimated_fare"]) for item in options]

        self.assertEqual(fares, sorted(fares))

    def test_transport_can_be_sorted_by_duration(self):
        response = self.client.get("/api/transport?sort_by=duration")

        options = response.get_json()["transport_options"]
        durations = [item["duration_minutes"] for item in options]

        self.assertEqual(durations, sorted(durations))

    def test_inactive_transport_options_are_excluded(self):
        response = self.client.get("/api/transport")

        providers = [
            item["provider"]
            for item in response.get_json()["transport_options"]
        ]
        self.assertNotIn("Inactive Bus", providers)

    def test_invalid_transport_type_is_rejected(self):
        response = self.client.get("/api/transport?type=train")

        self.assertEqual(response.status_code, 400)

    def test_invalid_sort_option_is_rejected(self):
        response = self.client.get("/api/transport?sort_by=provider")

        self.assertEqual(response.status_code, 400)

    def test_invalid_limit_is_rejected(self):
        response = self.client.get("/api/transport?limit=0")

        self.assertEqual(response.status_code, 400)

    def test_invalid_limit_text_is_rejected(self):
        response = self.client.get("/api/transport?limit=abc")

        self.assertEqual(response.status_code, 400)


class AdminTransportAPITests(unittest.TestCase):
    """Tests for administrator transport management."""

    def setUp(self):
        self.app = create_app(TestConfig)
        self.client = self.app.test_client()
        self.app_context = self.app.app_context()
        self.app_context.push()

        db.create_all()

        traveler_role = Role(name="traveler")
        admin_role = Role(name="admin")
        db.session.add_all([traveler_role, admin_role])
        db.session.flush()

        traveler = User(
            full_name="Test Traveler",
            email="traveler@example.com",
            role_id=traveler_role.id,
        )
        traveler.set_password("StrongPass123")

        admin = User(
            full_name="Test Admin",
            email="admin@example.com",
            role_id=admin_role.id,
        )
        admin.set_password("StrongPass123")

        db.session.add_all([traveler, admin])
        db.session.commit()

        self.traveler_token = self.login("traveler@example.com")
        self.admin_token = self.login("admin@example.com")

    def tearDown(self):
        db.session.remove()
        db.drop_all()
        self.app_context.pop()

    def login(self, email):
        response = self.client.post(
            "/api/auth/login",
            json={
                "email": email,
                "password": "StrongPass123",
            },
        )
        return response.get_json()["access_token"]

    def headers(self, token):
        return {"Authorization": f"Bearer {token}"}

    def valid_transport(self):
        return {
            "transport_type": "sgr",
            "provider": "Kenya Railways",
            "origin": "Nairobi",
            "destination": "Mombasa",
            "estimated_fare": 1500,
            "duration_minutes": 300,
            "departure_time": "08:00",
            "arrival_time": "13:00",
            "booking_url": "https://example.com/book",
            "notes": "Indicative fare for testing.",
        }

    def test_transport_admin_requires_authentication(self):
        response = self.client.get("/api/admin/transport")
        self.assertEqual(response.status_code, 401)

    def test_traveler_cannot_manage_transport(self):
        response = self.client.get(
            "/api/admin/transport",
            headers=self.headers(self.traveler_token),
        )
        self.assertEqual(response.status_code, 403)

    def test_admin_can_create_transport_option(self):
        response = self.client.post(
            "/api/admin/transport",
            headers=self.headers(self.admin_token),
            json=self.valid_transport(),
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(
            response.get_json()["transport_option"]["provider"],
            "Kenya Railways",
        )

    def test_admin_can_list_transport_options(self):
        self.client.post(
            "/api/admin/transport",
            headers=self.headers(self.admin_token),
            json=self.valid_transport(),
        )

        response = self.client.get(
            "/api/admin/transport",
            headers=self.headers(self.admin_token),
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json()["count"], 1)

    def test_admin_can_update_transport_option(self):
        created = self.client.post(
            "/api/admin/transport",
            headers=self.headers(self.admin_token),
            json=self.valid_transport(),
        )
        transport_id = created.get_json()["transport_option"]["id"]

        response = self.client.patch(
            f"/api/admin/transport/{transport_id}",
            headers=self.headers(self.admin_token),
            json={"estimated_fare": 1800, "provider": "Updated Railways"},
        )

        self.assertEqual(response.status_code, 200)
        updated = response.get_json()["transport_option"]
        self.assertEqual(updated["provider"], "Updated Railways")
        self.assertEqual(updated["estimated_fare"], "1800.00")

    def test_admin_can_deactivate_transport_option(self):
        created = self.client.post(
            "/api/admin/transport",
            headers=self.headers(self.admin_token),
            json=self.valid_transport(),
        )
        transport_id = created.get_json()["transport_option"]["id"]

        response = self.client.patch(
            f"/api/admin/transport/{transport_id}",
            headers=self.headers(self.admin_token),
            json={"is_active": False},
        )

        self.assertEqual(response.status_code, 200)
        self.assertFalse(
            response.get_json()["transport_option"]["is_active"]
        )

    def test_invalid_transport_type_is_rejected(self):
        data = self.valid_transport()
        data["transport_type"] = "train"

        response = self.client.post(
            "/api/admin/transport",
            headers=self.headers(self.admin_token),
            json=data,
        )

        self.assertEqual(response.status_code, 400)

    def test_negative_transport_fare_is_rejected(self):
        data = self.valid_transport()
        data["estimated_fare"] = -100

        response = self.client.post(
            "/api/admin/transport",
            headers=self.headers(self.admin_token),
            json=data,
        )

        self.assertEqual(response.status_code, 400)

    def test_same_origin_and_destination_are_rejected(self):
        data = self.valid_transport()
        data["destination"] = "Nairobi"

        response = self.client.post(
            "/api/admin/transport",
            headers=self.headers(self.admin_token),
            json=data,
        )

        self.assertEqual(response.status_code, 400)

    def test_admin_can_list_inactive_transport_options(self):
        data = self.valid_transport()
        data["is_active"] = False

        self.client.post(
            "/api/admin/transport",
            headers=self.headers(self.admin_token),
            json=data,
        )

        response = self.client.get(
            "/api/admin/transport",
            headers=self.headers(self.admin_token),
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json()["count"], 1)
        self.assertFalse(
            response.get_json()["transport_options"][0]["is_active"]
        )


if __name__ == "__main__":
    unittest.main()


class RecommendationAPITests(unittest.TestCase):
    """Tests for content-based destination recommendations."""

    def setUp(self):
        from app.models import Destination

        self.app = create_app(TestConfig)
        self.client = self.app.test_client()
        self.app_context = self.app.app_context()
        self.app_context.push()

        db.create_all()

        db.session.add_all([
            Destination(
                name="Maasai Mara",
                country="Kenya",
                region="Narok County",
                category="Wildlife & Safari",
                description="Wildlife and savannah safari experiences.",
                estimated_daily_cost=Decimal("12000"),
                is_featured=True,
            ),
            Destination(
                name="Diani Beach",
                country="Kenya",
                region="Kwale County",
                category="Coastal Escape",
                description="Beach and ocean relaxation.",
                estimated_daily_cost=Decimal("8000"),
            ),
            Destination(
                name="Arusha",
                country="Tanzania",
                category="Wildlife & Safari",
                description="Safari destination.",
            ),
        ])
        db.session.commit()

    def tearDown(self):
        db.session.remove()
        db.drop_all()
        self.app_context.pop()

    def test_recommendations_return_kenyan_destinations(self):
        response = self.client.get("/api/recommendations")

        self.assertEqual(response.status_code, 200)
        data = response.get_json()
        self.assertEqual(data["count"], 2)
        self.assertTrue(
            all(
                item["country"] == "Kenya"
                for item in data["recommendations"]
            )
        )

    def test_travel_style_influences_ranking(self):
        response = self.client.get(
            "/api/recommendations?travel_style=Wildlife%20%26%20Safari"
        )

        recommendations = response.get_json()["recommendations"]
        self.assertEqual(recommendations[0]["name"], "Maasai Mara")

    def test_budget_excludes_destinations_over_budget(self):
        response = self.client.get(
            "/api/recommendations?budget=25000&duration_days=3"
        )

        recommendations = response.get_json()["recommendations"]
        self.assertNotIn(
            "Maasai Mara",
            [item["name"] for item in recommendations],
        )
        self.assertIn(
            "Diani Beach",
            [item["name"] for item in recommendations],
        )

    def test_interest_influences_recommendations(self):
        response = self.client.get(
            "/api/recommendations?interest=beach"
        )

        recommendations = response.get_json()["recommendations"]
        self.assertEqual(recommendations[0]["name"], "Diani Beach")

    def test_negative_budget_is_rejected(self):
        response = self.client.get("/api/recommendations?budget=-100")
        self.assertEqual(response.status_code, 400)


class AdminAPITests(unittest.TestCase):
    """Tests for administrator authorization and management."""

    def setUp(self):
        self.app = create_app(TestConfig)
        self.client = self.app.test_client()
        self.app_context = self.app.app_context()
        self.app_context.push()

        db.create_all()

        from app.models import Destination

        db.session.add_all([
            Role(name="traveler", description="Test traveler"),
            Role(name="admin", description="Test administrator"),
            Role(name="agency", description="Test agency"),
        ])
        db.session.commit()

        self.traveler = User(
            full_name="Test Traveler",
            email="traveler@example.com",
            role_id=db.session.scalar(
                select(Role).where(Role.name == "traveler")
            ).id,
        )
        self.traveler.set_password("StrongPass123")

        self.admin = User(
            full_name="Test Administrator",
            email="admin@example.com",
            role_id=db.session.scalar(
                select(Role).where(Role.name == "admin")
            ).id,
        )
        self.admin.set_password("StrongPass123")

        db.session.add_all([self.traveler, self.admin])
        db.session.commit()

        self.traveler_token = self.login("traveler@example.com")
        self.admin_token = self.login("admin@example.com")

    def tearDown(self):
        db.session.remove()
        db.drop_all()
        self.app_context.pop()

    def login(self, email):
        response = self.client.post(
            "/api/auth/login",
            json={
                "email": email,
                "password": "StrongPass123",
            },
        )
        return response.get_json()["access_token"]

    def headers(self, token):
        return {"Authorization": f"Bearer {token}"}

    def test_admin_dashboard_requires_authentication(self):
        response = self.client.get("/api/admin/dashboard")
        self.assertEqual(response.status_code, 401)

    def test_traveler_cannot_access_admin_dashboard(self):
        response = self.client.get(
            "/api/admin/dashboard",
            headers=self.headers(self.traveler_token),
        )
        self.assertEqual(response.status_code, 403)

    def test_admin_can_access_dashboard(self):
        response = self.client.get(
            "/api/admin/dashboard",
            headers=self.headers(self.admin_token),
        )

        self.assertEqual(response.status_code, 200)
        self.assertIn("statistics", response.get_json())

    def test_admin_can_create_kenyan_destination(self):
        response = self.client.post(
            "/api/admin/destinations",
            headers=self.headers(self.admin_token),
            json={
                "name": "Test Destination",
                "region": "Nakuru County",
                "category": "Nature & Adventure",
                "description": "A test destination in Kenya.",
                "estimated_daily_cost": 5000,
            },
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(
            response.get_json()["destination"]["country"],
            "Kenya",
        )

    def test_admin_cannot_create_non_kenyan_destination(self):
        response = self.client.post(
            "/api/admin/destinations",
            headers=self.headers(self.admin_token),
            json={
                "name": "Test Destination",
                "country": "Tanzania",
            },
        )

        self.assertEqual(response.status_code, 400)


if __name__ == "__main__":
    unittest.main()
