"""Itinerary generation and retrieval endpoints."""

from datetime import timedelta
from decimal import Decimal

from flask import Blueprint, current_app, jsonify
from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError

from ..extensions import db
from ..models import Destination, GeneratedItinerary, TripPreference

itineraries_bp = Blueprint("itineraries", __name__)

# Initial itinerary suggestions. These are not confirmed bookings.
ACTIVITY_TEMPLATES = {
    "Wildlife & Safari": [
        [
            ("Morning", "Early wildlife exploration",
             "Plan a suitable early wildlife experience."),
            ("Afternoon", "Scenic landscape discovery",
             "Explore the surrounding landscape and allow time for rest."),
            ("Evening", "Relax and review the day",
             "Allow time for dinner and preparation for the next day."),
        ],
        [
            ("Morning", "Nature observation",
             "Choose a suitable outdoor or wildlife activity."),
            ("Afternoon", "Local attraction visit",
             "Explore a relevant attraction, allowing time for travel."),
            ("Evening", "Leisure time",
             "Keep the evening flexible for rest or optional activities."),
        ],
    ],
    "Nature & Adventure": [
        [
            ("Morning", "Outdoor exploration",
             "Plan a suitable nature walk or outdoor excursion."),
            ("Afternoon", "Scenic viewpoint",
             "Explore the area's scenery at a comfortable pace."),
            ("Evening", "Rest and prepare",
             "Allow time to rest and review the next day's plans."),
        ],
        [
            ("Morning", "Nature trail",
             "Choose a route suitable for your ability and local conditions."),
            ("Afternoon", "Explore local surroundings",
             "Allow time for photography, meals and transport."),
            ("Evening", "Relaxation",
             "Keep the evening available for rest."),
        ],
    ],
    "Coastal Escape": [
        [
            ("Morning", "Coastal discovery",
             "Plan a beach visit or suitable coastal activity."),
            ("Afternoon", "Local exploration",
             "Explore nearby places and allow time for lunch."),
            ("Evening", "Sunset and relaxation",
             "Keep the evening flexible for leisure."),
        ],
        [
            ("Morning", "Beach and nature time",
             "Choose an activity that suits local conditions."),
            ("Afternoon", "Local attraction",
             "Explore a nearby attraction where available."),
            ("Evening", "Leisure time",
             "Allow time to rest and prepare for the next day."),
        ],
    ],
    "Culture & Heritage": [
        [
            ("Morning", "Heritage discovery",
             "Plan a visit to a relevant cultural or historical attraction."),
            ("Afternoon", "Local culture and cuisine",
             "Explore local food and cultural experiences where available."),
            ("Evening", "Reflect and relax",
             "Keep time available for dinner and rest."),
        ],
        [
            ("Morning", "Historic site visit",
             "Choose a suitable heritage attraction."),
            ("Afternoon", "Local arts and culture",
             "Explore local crafts or cultural experiences where available."),
            ("Evening", "Leisure time",
             "Leave the schedule flexible."),
        ],
    ],
    "Relaxation & Wellness": [
        [
            ("Morning", "Slow morning",
             "Start with a relaxed breakfast and an unhurried morning."),
            ("Afternoon", "Leisure activity",
             "Choose a suitable relaxation or wellness experience."),
            ("Evening", "Unwind",
             "Keep the evening free for rest."),
        ],
        [
            ("Morning", "Gentle exploration",
             "Plan an easy activity at a comfortable pace."),
            ("Afternoon", "Rest and recharge",
             "Leave space for relaxation and meals."),
            ("Evening", "Personal time",
             "Keep the evening flexible."),
        ],
    ],
}

DEFAULT_ACTIVITIES = ACTIVITY_TEMPLATES["Nature & Adventure"]


def build_plan(preference, destination):
    """Build a structured itinerary from saved trip preferences."""
    day_count = (preference.end_date - preference.start_date).days + 1

    if not 1 <= day_count <= 30:
        raise ValueError("Itineraries must cover between 1 and 30 days.")

    templates = ACTIVITY_TEMPLATES.get(
        preference.travel_style,
        DEFAULT_ACTIVITIES,
    )

    days = []

    for index in range(day_count):
        activities_for_day = templates[index % len(templates)]
        current_date = preference.start_date + timedelta(days=index)

        activities = [
            {
                "time": time,
                "title": title,
                "description": description,
                "estimated_cost_kes": None,
            }
            for time, title, description in activities_for_day
        ]

        days.append({
            "day": index + 1,
            "date": current_date.isoformat(),
            "activities": activities,
        })

    budget = preference.budget
    daily_budget = (
        (Decimal(str(budget)) / Decimal(day_count)).quantize(Decimal("0.01"))
        if budget is not None
        else None
    )

    destination_details = None
    if destination is not None:
        destination_details = {
            "id": destination.id,
            "country": destination.country,
            "region": destination.region,
            "category": destination.category,
            "image_url": destination.image_url,
        }

    return {
        "destination": preference.destination,
        "destination_details": destination_details,
        "travel_style": preference.travel_style,
        "start_date": preference.start_date.isoformat(),
        "end_date": preference.end_date.isoformat(),
        "duration_days": day_count,
        "budget_kes": str(budget) if budget is not None else None,
        "daily_budget_guidance_kes": (
            str(daily_budget) if daily_budget is not None else None
        ),
        "days": days,
        "notice": (
            "Activities are planning suggestions, not confirmed bookings. "
            "Verify availability, opening times, transport, safety conditions "
            "and current prices with relevant providers. Daily budget guidance "
            "is a simple allocation of your stated budget, not a price quote."
        ),
    }


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
