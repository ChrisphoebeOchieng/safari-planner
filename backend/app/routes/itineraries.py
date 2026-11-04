"""Itinerary generation and retrieval endpoints."""

from flask import Blueprint, current_app, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required
from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError

from ..extensions import db
from ..models import Destination, GeneratedItinerary, TripPreference
from ..services.itinerary_service import build_plan
from ..services.guest_access import verify_guest_access_token

itineraries_bp = Blueprint("itineraries", __name__)


def get_authenticated_user_id():
    """Return the authenticated user's database ID."""
    try:
        return int(get_jwt_identity())
    except (TypeError, ValueError):
        return None


def get_owned_itinerary(itinerary_id, user_id):
    """Retrieve an itinerary only when its preference belongs to the user."""
    return db.session.scalar(
        select(GeneratedItinerary)
        .join(
            TripPreference,
            GeneratedItinerary.trip_preference_id == TripPreference.id,
        )
        .where(
            GeneratedItinerary.id == itinerary_id,
            TripPreference.user_id == user_id,
        )
    )


@itineraries_bp.post("/trip-preferences/<int:preference_id>/generate")
@jwt_required(optional=True)
def generate_itinerary(preference_id):
    """Generate and save an itinerary for a submitted trip preference."""
    preference = db.session.get(TripPreference, preference_id)

    if preference is None:
        return jsonify({"error": "Trip preferences not found."}), 404

    identity = get_jwt_identity()

    if preference.user_id is not None:
        try:
            user_id = int(identity) if identity is not None else None
        except (TypeError, ValueError):
            user_id = None

        if user_id != preference.user_id:
            return jsonify({"error": "Trip preferences not found."}), 404
    elif not verify_guest_access_token(
        preference,
        request.headers.get("X-Guest-Access-Token"),
    ):
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
@jwt_required()
def get_itinerary(itinerary_id):
    """Retrieve a saved itinerary belonging to the authenticated user."""
    user_id = get_authenticated_user_id()

    if user_id is None:
        return jsonify({"error": "Invalid authenticated user."}), 401

    saved = get_owned_itinerary(itinerary_id, user_id)

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
@jwt_required()
def list_itineraries():
    """List only saved itineraries belonging to the authenticated user."""
    user_id = get_authenticated_user_id()

    if user_id is None:
        return jsonify({"error": "Invalid authenticated user."}), 401

    try:
        saved_itineraries = db.session.scalars(
            select(GeneratedItinerary)
            .join(
                TripPreference,
                GeneratedItinerary.trip_preference_id == TripPreference.id,
            )
            .where(TripPreference.user_id == user_id)
            .order_by(
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
@jwt_required()
def delete_itinerary(itinerary_id):
    """Delete a saved itinerary belonging to the authenticated user."""
    user_id = get_authenticated_user_id()

    if user_id is None:
        return jsonify({"error": "Invalid authenticated user."}), 401

    saved = get_owned_itinerary(itinerary_id, user_id)

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
