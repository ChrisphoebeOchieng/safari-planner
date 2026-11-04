"""API endpoints for trip planning preferences."""

from datetime import date
from decimal import Decimal, InvalidOperation

from flask import Blueprint, current_app, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required
from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError

from ..extensions import db
from ..models import Destination, GeneratedItinerary, TripPreference
from ..services.itinerary_service import build_plan
from ..services.guest_access import (
    generate_guest_access_token,
    verify_guest_access_token,
)

trip_preferences_bp = Blueprint("trip_preferences", __name__)

ALLOWED_TRAVEL_STYLES = {
    "Wildlife & Safari",
    "Nature & Adventure",
    "Coastal Escape",
    "Culture & Heritage",
    "Relaxation & Wellness",
}


def validate_trip_data(data, require_duration_limit=False):
    """Validate and normalize submitted trip preferences."""
    if not isinstance(data, dict):
        return None, "A JSON request body is required."

    destination = data.get("destination")

    if not isinstance(destination, str) or not destination.strip():
        return None, "Destination is required."

    destination = destination.strip()

    if len(destination) > 150:
        return None, "Destination must be 150 characters or fewer."

    try:
        start_date = date.fromisoformat(data.get("start_date", ""))
        end_date = date.fromisoformat(data.get("end_date", ""))
    except (TypeError, ValueError):
        return None, "Provide valid start and end dates."

    if end_date < start_date:
        return None, "End date cannot be before start date."

    day_count = (end_date - start_date).days + 1

    if require_duration_limit and not 1 <= day_count <= 30:
        return None, "Itineraries must cover between 1 and 30 days."

    travel_style = data.get("travel_style", "Wildlife & Safari")

    if travel_style not in ALLOWED_TRAVEL_STYLES:
        return None, "Choose a valid travel style."

    raw_budget = data.get("budget")
    budget = None

    if raw_budget not in (None, ""):
        try:
            budget = Decimal(str(raw_budget))
        except (InvalidOperation, TypeError, ValueError):
            return None, "Budget must be a valid number."

        if not budget.is_finite() or budget < 0:
            return None, "Budget cannot be negative or invalid."

    return {
        "destination": destination,
        "start_date": start_date,
        "end_date": end_date,
        "travel_style": travel_style,
        "budget": budget,
    }, None


def serialize_preference(preference):
    """Return a consistent trip preference response."""
    return {
        "id": preference.id,
        "destination": preference.destination,
        "start_date": preference.start_date.isoformat(),
        "end_date": preference.end_date.isoformat(),
        "travel_style": preference.travel_style,
        "budget": (
            str(preference.budget)
            if preference.budget is not None
            else None
        ),
        "status": preference.status,
    }


def preference_belongs_to_another_user(preference):
    """Check whether a preference is owned by someone else."""
    if preference.user_id is None:
        return False

    identity = get_jwt_identity()

    if identity is None:
        return True

    try:
        return preference.user_id != int(identity)
    except (TypeError, ValueError):
        return True


@trip_preferences_bp.post("/trip-preferences")
@jwt_required(optional=True)
def create_trip_preference():
    """Validate and save trip preferences for a visitor or user."""
    data, error = validate_trip_data(request.get_json(silent=True))

    if error:
        return jsonify({"error": error}), 400

    identity = get_jwt_identity()

    try:
        user_id = int(identity) if identity is not None else None
    except (TypeError, ValueError):
        return jsonify({"error": "Invalid authenticated user."}), 401

    guest_access_token = None
    guest_access_token_hash = None

    if user_id is None:
        guest_access_token, guest_access_token_hash = (
            generate_guest_access_token()
        )

    preference = TripPreference(
        **data,
        user_id=user_id,
        guest_access_token_hash=guest_access_token_hash,
    )

    try:
        db.session.add(preference)
        db.session.commit()
    except SQLAlchemyError:
        db.session.rollback()
        current_app.logger.exception(
            "Could not save trip preferences."
        )
        return jsonify({
            "error": "Unable to save preferences right now."
        }), 500

    return jsonify({
        "message": "Trip preferences saved successfully.",
        "preference": serialize_preference(preference),
        **(
            {"guest_access_token": guest_access_token}
            if guest_access_token
            else {}
        ),
    }), 201


@trip_preferences_bp.put("/trip-preferences/<int:preference_id>")
@jwt_required(optional=True)
def update_trip_preference(preference_id):
    """Update preferences and regenerate the associated itinerary."""
    preference = db.session.get(TripPreference, preference_id)

    if preference is None or preference_belongs_to_another_user(preference):
        return jsonify({"error": "Trip preferences not found."}), 404

    if preference.user_id is None and not verify_guest_access_token(
        preference,
        request.headers.get("X-Guest-Access-Token"),
    ):
        return jsonify({"error": "Trip preferences not found."}), 404

    data, error = validate_trip_data(
        request.get_json(silent=True),
        require_duration_limit=True,
    )

    if error:
        return jsonify({"error": error}), 400

    try:
        preference.destination = data["destination"]
        preference.start_date = data["start_date"]
        preference.end_date = data["end_date"]
        preference.travel_style = data["travel_style"]
        preference.budget = data["budget"]

        destination = db.session.scalar(
            select(Destination).where(
                Destination.name.ilike(preference.destination),
                Destination.country == "Kenya",
            )
        )

        saved = db.session.scalar(
            select(GeneratedItinerary).where(
                GeneratedItinerary.trip_preference_id == preference.id
            )
        )

        itinerary_updated = False
        itinerary_id = None

        if saved is not None:
            saved.plan = build_plan(preference, destination)
            itinerary_updated = True
            itinerary_id = saved.id

        db.session.commit()

        return jsonify({
            "message": "Trip updated successfully.",
            "preference": serialize_preference(preference),
            "itinerary_updated": itinerary_updated,
            "itinerary_id": itinerary_id,
        }), 200

    except (SQLAlchemyError, ValueError):
        db.session.rollback()
        current_app.logger.exception(
            "Could not update trip preferences and itinerary."
        )
        return jsonify({
            "error": "Unable to update the trip right now. "
                     "Your previous saved data has been preserved."
        }), 500
