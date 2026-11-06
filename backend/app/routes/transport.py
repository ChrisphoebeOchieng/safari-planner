"""Transport comparison API for travel within Kenya."""

from flask import Blueprint, jsonify, request
from sqlalchemy import select

from ..extensions import db
from ..models import TransportOption

transport_bp = Blueprint("transport", __name__)

TRANSPORT_TYPES = {"flight", "bus", "sgr"}


def serialize_transport_option(item):
    """Convert a transport option into JSON-safe data."""
    return {
        "id": item.id,
        "transport_type": item.transport_type,
        "provider": item.provider,
        "origin": item.origin,
        "destination": item.destination,
        "estimated_fare": (
            str(item.estimated_fare)
            if item.estimated_fare is not None else None
        ),
        "currency": "KES",
        "duration_minutes": item.duration_minutes,
        "departure_time": item.departure_time,
        "arrival_time": item.arrival_time,
        "booking_url": item.booking_url,
        "image_url": item.image_url,
        "notes": item.notes,
        "fare_type": "indicative",
    }


@transport_bp.get("/transport")
def list_transport_options():
    """Compare active transport options using optional filters."""
    origin = request.args.get("origin", "").strip()
    destination = request.args.get("destination", "").strip()
    transport_type = request.args.get("type", "").strip().lower()
    sort_by = request.args.get("sort_by", "fare").strip().lower()
    raw_limit = request.args.get("limit")

    try:
        limit = int(raw_limit) if raw_limit is not None else 50
    except (TypeError, ValueError):
        return jsonify({
            "error": "Limit must be a valid integer."
        }), 400

    if len(origin) > 150 or len(destination) > 150:
        return jsonify({
            "error": "Origin and destination must be 150 characters or fewer."
        }), 400

    if transport_type and transport_type not in TRANSPORT_TYPES:
        return jsonify({
            "error": "Type must be flight, bus or sgr."
        }), 400

    if sort_by not in {"fare", "duration"}:
        return jsonify({
            "error": "sort_by must be fare or duration."
        }), 400

    if limit is None or not 1 <= limit <= 100:
        return jsonify({
            "error": "Limit must be between 1 and 100."
        }), 400

    statement = select(TransportOption).where(
        TransportOption.is_active.is_(True)
    )

    if origin:
        statement = statement.where(
            TransportOption.origin.ilike(f"%{origin}%")
        )

    if destination:
        statement = statement.where(
            TransportOption.destination.ilike(f"%{destination}%")
        )

    if transport_type:
        statement = statement.where(
            TransportOption.transport_type == transport_type
        )

    if sort_by == "duration":
        statement = statement.order_by(
            TransportOption.duration_minutes.asc().nullslast(),
            TransportOption.estimated_fare.asc().nullslast(),
        )
    else:
        statement = statement.order_by(
            TransportOption.estimated_fare.asc().nullslast()
        )

    items = db.session.scalars(statement.limit(limit)).all()

    return jsonify({
        "count": len(items),
        "transport_options": [
            serialize_transport_option(item) for item in items
        ],
        "disclaimer": (
            "Fares and journey durations are indicative estimates. "
            "Confirm current prices, schedules and availability with "
            "the transport provider before travelling."
        ),
    }), 200
