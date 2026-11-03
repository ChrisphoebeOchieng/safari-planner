"""Itinerary generation and retrieval endpoints."""


from flask import Blueprint, current_app, jsonify
from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError

from ..extensions import db
from ..models import Destination, GeneratedItinerary, TripPreference
from ..services.itinerary_service import build_plan

itineraries_bp = Blueprint("itineraries", __name__)

@itineraries_bp.post("/trip-preferences/<int:preference_id>/generate")
def generate_itinerary(preference_id):
    """Generate and save an itinerary for a submitted trip preference."""
    preference = db.session.get(TripPreference, preference_id)

    if preference is None:
        return jsonify({"error": "Trip preferences not found."}), 404

    day_count = (preference.end_date - preference.start_date).days + 1

    if not 1 <= day_count <= 30:
        return jsonify({
            "error": "Itineraries must cover between 1 and 30 days."
        }), 400

    try:
        destination = db.session.scalar(
            select(Destination).where(
                Destination.name.ilike(preference.destination),
                Destination.country == "Kenya",
            )
        )

        plan = build_plan(preference, destination)

        saved = db.session.scalar(
            select(GeneratedItinerary).where(
                GeneratedItinerary.trip_preference_id == preference.id
            )
        )

        if saved is None:
            saved = GeneratedItinerary(
                trip_preference_id=preference.id,
                plan=plan,
            )
            db.session.add(saved)
        else:
            saved.plan = plan

        db.session.commit()

        return jsonify({
            "message": "Itinerary generated and saved.",
            "itinerary_id": saved.id,
            "plan": saved.plan,
        }), 201

    except SQLAlchemyError:
        db.session.rollback()
        current_app.logger.exception(
            "Failed to save generated itinerary."
        )
        return jsonify({
            "error": "Unable to save the itinerary right now."
        }), 500


@itineraries_bp.get("/itineraries/<int:itinerary_id>")
def get_itinerary(itinerary_id):
    """Retrieve a previously saved generated itinerary."""
    saved = db.session.get(GeneratedItinerary, itinerary_id)

    if saved is None:
        return jsonify({"error": "Itinerary not found."}), 404

    return jsonify({
        "itinerary_id": saved.id,
        "trip_preference_id": saved.trip_preference_id,
        "created_at": (
            saved.created_at.isoformat() if saved.created_at else None
        ),
        "plan": saved.plan,
    }), 200


@itineraries_bp.get("/itineraries")
def list_itineraries():
    """List saved itineraries for the dashboard."""
    try:
        saved_itineraries = db.session.scalars(
            select(GeneratedItinerary).order_by(
                GeneratedItinerary.created_at.desc(),
                GeneratedItinerary.id.desc(),
            )
        ).all()

        itineraries = [
            {
                "itinerary_id": item.id,
                "trip_preference_id": item.trip_preference_id,
                "created_at": (
                    item.created_at.isoformat()
                    if item.created_at
                    else None
                ),
                "destination": item.plan.get("destination"),
                "start_date": item.plan.get("start_date"),
                "end_date": item.plan.get("end_date"),
                "duration_days": item.plan.get("duration_days"),
                "travel_style": item.plan.get("travel_style"),
                "budget_kes": item.plan.get("budget_kes"),
                "destination_details": item.plan.get(
                    "destination_details"
                ),
            }
            for item in saved_itineraries
        ]

        return jsonify({
            "count": len(itineraries),
            "itineraries": itineraries,
        }), 200

    except SQLAlchemyError:
        current_app.logger.exception(
            "Failed to retrieve saved itineraries."
        )
        return jsonify({
            "error": "Unable to retrieve saved itineraries right now."
        }), 500

@itineraries_bp.delete("/itineraries/<int:itinerary_id>")
def delete_itinerary(itinerary_id):
    """Delete a saved generated itinerary."""
    saved = db.session.get(GeneratedItinerary, itinerary_id)

    if saved is None:
        return jsonify({"error": "Itinerary not found."}), 404

    try:
        db.session.delete(saved)
        db.session.commit()

        return jsonify({
            "message": "Saved itinerary deleted successfully.",
            "itinerary_id": itinerary_id,
        }), 200

    except SQLAlchemyError:
        db.session.rollback()
        current_app.logger.exception(
            "Failed to delete saved itinerary."
        )
        return jsonify({
            "error": "Unable to delete the itinerary right now."
        }), 500
