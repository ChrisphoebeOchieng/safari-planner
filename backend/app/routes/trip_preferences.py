"""API endpoints for trip planning preferences."""

from datetime import date
from decimal import Decimal, InvalidOperation

from flask import Blueprint, current_app, jsonify, request
from sqlalchemy.exc import SQLAlchemyError

from ..extensions import db
from ..models import TripPreference

trip_preferences_bp = Blueprint(
    "trip_preferences",
    __name__,
)

ALLOWED_TRAVEL_STYLES = {
    "Wildlife & Safari",
    "Nature & Adventure",
    "Coastal Escape",
    "Culture & Heritage",
    "Relaxation & Wellness",
}


@trip_preferences_bp.post("/trip-preferences")
def create_trip_preference():
    """Validate and save a visitor's trip preferences."""
    data = request.get_json(silent=True)

    if not isinstance(data, dict):
        return jsonify({"error": "A JSON request body is required."}), 400

    destination = data.get("destination")
    if not isinstance(destination, str) or not destination.strip():
        return jsonify({"error": "Destination is required."}), 400

    destination = destination.strip()
    if len(destination) > 150:
        return jsonify({"error": "Destination must be 150 characters or fewer."}), 400

    try:
        start_date = date.fromisoformat(data.get("start_date", ""))
        end_date = date.fromisoformat(data.get("end_date", ""))
    except (TypeError, ValueError):
        return jsonify({"error": "Provide valid start and end dates."}), 400

    if end_date < start_date:
        return jsonify({"error": "End date cannot be before start date."}), 400

    travel_style = data.get("travel_style", "Wildlife & Safari")
    if travel_style not in ALLOWED_TRAVEL_STYLES:
        return jsonify({"error": "Choose a valid travel style."}), 400

    raw_budget = data.get("budget")
    budget = None

    if raw_budget not in (None, ""):
        try:
            # Convert to Decimal to preserve financial precision.
            budget = Decimal(str(raw_budget))
        except (InvalidOperation, TypeError, ValueError):
            return jsonify({"error": "Budget must be a valid number."}), 400

        if not budget.is_finite() or budget < 0:
            return jsonify({"error": "Budget cannot be negative or invalid."}), 400

    preference = TripPreference(
        destination=destination,
        start_date=start_date,
        end_date=end_date,
        travel_style=travel_style,
        budget=budget,
    )

    try:
        db.session.add(preference)
        db.session.commit()
    except SQLAlchemyError:
        db.session.rollback()
        current_app.logger.exception("Could not save trip preferences.")
        return jsonify({"error": "Unable to save preferences right now."}), 500

    return jsonify({
        "message": "Trip preferences saved successfully.",
        "preference": {
            "id": preference.id,
            "destination": preference.destination,
            "start_date": preference.start_date.isoformat(),
            "end_date": preference.end_date.isoformat(),
            "travel_style": preference.travel_style,
            "budget": str(preference.budget) if preference.budget is not None else None,
            "status": preference.status,
        },
    }), 201
