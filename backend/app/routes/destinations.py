"""Public destination discovery API."""

from flask import Blueprint, jsonify, request
from sqlalchemy import or_, select

from ..extensions import db
from ..models import Destination

destinations_bp = Blueprint("destinations", __name__)


def serialize_destination(destination):
    """Convert a destination model into JSON-safe data."""
    return {
        "id": destination.id,
        "name": destination.name,
        "country": destination.country,
        "region": destination.region,
        "description": destination.description,
        "category": destination.category,
        "image_url": destination.image_url,
        "estimated_daily_cost": (
            str(destination.estimated_daily_cost)
            if destination.estimated_daily_cost is not None
            else None
        ),
        "is_featured": destination.is_featured,
    }


@destinations_bp.get("/destinations")
def list_destinations():
    """List destinations with optional search and filtering."""
    statement = select(Destination)

    search = request.args.get("q", "").strip()
    category = request.args.get("category", "").strip()
    featured = request.args.get("featured", "").strip().lower()

    if len(search) > 100 or len(category) > 80:
        return jsonify({"error": "Search parameters are too long."}), 400

    if featured and featured not in {"true", "false"}:
        return jsonify({
            "error": "The featured parameter must be true or false."
        }), 400

    if search:
        pattern = f"%{search}%"
        statement = statement.where(
            or_(
                Destination.name.ilike(pattern),
                Destination.country.ilike(pattern),
                Destination.region.ilike(pattern),
            )
        )

    if category:
        statement = statement.where(
            Destination.category.ilike(f"%{category}%")
        )

    if featured:
        statement = statement.where(
            Destination.is_featured == (featured == "true")
        )

    statement = statement.order_by(
        Destination.is_featured.desc(),
        Destination.name.asc(),
    )

    destinations = db.session.scalars(statement).all()

    return jsonify({
        "count": len(destinations),
        "destinations": [
            serialize_destination(destination)
            for destination in destinations
        ],
    }), 200


@destinations_bp.get("/destinations/<int:destination_id>")
def get_destination(destination_id):
    """Retrieve a single destination by its ID."""
    destination = db.session.get(Destination, destination_id)

    if destination is None:
        return jsonify({"error": "Destination not found."}), 404

    return jsonify({
        "destination": serialize_destination(destination)
    }), 200
