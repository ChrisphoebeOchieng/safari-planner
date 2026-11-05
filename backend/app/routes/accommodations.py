"""Accommodation discovery API."""

from flask import Blueprint, jsonify, request
from sqlalchemy import select

from ..extensions import db
from ..models import Accommodation, Destination

accommodations_bp = Blueprint("accommodations", __name__)


def serialize_accommodation(item):
    """Convert an accommodation into JSON-safe data."""
    return {
        "id": item.id,
        "destination_id": item.destination_id,
        "destination": item.destination.name,
        "name": item.name,
        "accommodation_type": item.accommodation_type,
        "location": item.location,
        "description": item.description,
        "estimated_nightly_rate": (
            str(item.estimated_nightly_rate)
            if item.estimated_nightly_rate is not None else None
        ),
        "image_url": item.image_url,
        "website_url": item.website_url,
        "contact_phone": item.contact_phone,
        "is_featured": item.is_featured,
    }


@accommodations_bp.get("/accommodations")
def list_accommodations():
    """List accommodation options with optional filters."""
    statement = (
        select(Accommodation)
        .join(Destination)
        .where(Destination.country == "Kenya")
    )

    destination_id = request.args.get("destination_id", type=int)
    accommodation_type = request.args.get("type", "").strip()
    max_rate = request.args.get("max_rate", "").strip()

    if request.args.get("destination_id") and destination_id is None:
        return jsonify({"error": "Invalid destination_id."}), 400

    if len(accommodation_type) > 60:
        return jsonify({"error": "Accommodation type is too long."}), 400

    if destination_id is not None:
        statement = statement.where(
            Accommodation.destination_id == destination_id
        )

    if accommodation_type:
        statement = statement.where(
            Accommodation.accommodation_type.ilike(
                f"%{accommodation_type}%"
            )
        )

    if max_rate:
        try:
            rate = float(max_rate)
            if rate < 0 or not rate < float("inf"):
                raise ValueError
        except ValueError:
            return jsonify({"error": "Invalid maximum nightly rate."}), 400

        statement = statement.where(
            Accommodation.estimated_nightly_rate <= rate
        )

    statement = statement.order_by(
        Accommodation.is_featured.desc(),
        Accommodation.name.asc(),
    )

    items = db.session.scalars(statement).all()

    return jsonify({
        "count": len(items),
        "accommodations": [
            serialize_accommodation(item) for item in items
        ],
    }), 200


@accommodations_bp.get("/accommodations/<int:accommodation_id>")
def get_accommodation(accommodation_id):
    """Retrieve an accommodation listing."""
    item = db.session.get(Accommodation, accommodation_id)

    if item is None or item.destination.country != "Kenya":
        return jsonify({"error": "Accommodation not found."}), 404

    return jsonify({
        "accommodation": serialize_accommodation(item)
    }), 200
