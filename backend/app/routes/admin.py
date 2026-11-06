"""Administrator dashboard and management API."""

from decimal import Decimal, InvalidOperation

from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required
from sqlalchemy import func, select
from sqlalchemy.exc import SQLAlchemyError

from ..auth.permissions import admin_required
from ..extensions import db
from ..models import (Accommodation, Destination, Itinerary, Role, TransportOption, User)
from .accommodations import serialize_accommodation
from .destinations import serialize_destination

admin_bp = Blueprint("admin", __name__)


def json_body():
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return None
    return data


def optional_text(data, field, maximum, required=False):
    value = data.get(field)

    if value is None:
        if required:
            return None, f"{field} is required."
        return None, None

    if not isinstance(value, str):
        return None, f"{field} must be text."

    value = value.strip()

    if required and not value:
        return None, f"{field} is required."

    if len(value) > maximum:
        return None, f"{field} must be {maximum} characters or fewer."

    return value or None, None


def optional_url(data, field):
    value, error = optional_text(data, field, 500)
    if error or value is None:
        return value, error

    if not value.startswith(("https://", "http://")):
        return None, f"{field} must be a valid HTTP or HTTPS URL."

    return value, None


def optional_money(data, field):
    value = data.get(field)

    if value is None or value == "":
        return None, None

    try:
        amount = Decimal(str(value))
        if not amount.is_finite() or amount < 0:
            raise InvalidOperation
        return amount, None
    except (InvalidOperation, ValueError, TypeError):
        return None, f"{field} must be a valid non-negative amount."


def optional_boolean(data, field, default=None):
    value = data.get(field, default)

    if value is None:
        return None, None

    if not isinstance(value, bool):
        return None, f"{field} must be true or false."

    return value, None


def validate_destination(data, destination=None):
    fields = {
        "name": (150, True),
        "region": (120, False),
        "description": (10000, False),
        "category": (80, False),
    }

    values = {}

    for field, (maximum, required) in fields.items():
        if field not in data and destination is not None:
            continue

        value, error = optional_text(
            data, field, maximum, required=required
        )
        if error:
            return None, error
        values[field] = value

    if "country" in data and data["country"] != "Kenya":
        return None, "Safari Planner only supports destinations in Kenya."

    if "image_url" in data:
        value, error = optional_url(data, "image_url")
        if error:
            return None, error
        values["image_url"] = value

    if "estimated_daily_cost" in data:
        value, error = optional_money(data, "estimated_daily_cost")
        if error:
            return None, error
        values["estimated_daily_cost"] = value

    if "is_featured" in data:
        value, error = optional_boolean(data, "is_featured")
        if error:
            return None, error
        values["is_featured"] = value

    return values, None


def validate_accommodation(data, item=None):
    fields = {
        "name": (180, True),
        "accommodation_type": (60, True),
        "location": (180, False),
        "description": (10000, False),
        "contact_phone": (40, False),
    }

    values = {}

    for field, (maximum, required) in fields.items():
        if field not in data and item is not None:
            continue

        value, error = optional_text(
            data, field, maximum, required=required
        )
        if error:
            return None, error
        values[field] = value

    if "destination_id" in data or item is None:
        destination_id = data.get("destination_id")

        if isinstance(destination_id, bool):
            return None, "destination_id must be a valid integer."

        try:
            destination_id = int(destination_id)
        except (TypeError, ValueError):
            return None, "destination_id must be a valid integer."

        destination = db.session.get(Destination, destination_id)

        if destination is None or destination.country != "Kenya":
            return None, "Select an existing Kenyan destination."

        values["destination_id"] = destination_id

    if "estimated_nightly_rate" in data:
        value, error = optional_money(data, "estimated_nightly_rate")
        if error:
            return None, error
        values["estimated_nightly_rate"] = value

    for field in ("image_url", "website_url"):
        if field in data:
            value, error = optional_url(data, field)
            if error:
                return None, error
            values[field] = value

    if "is_featured" in data:
        value, error = optional_boolean(data, "is_featured")
        if error:
            return None, error
        values["is_featured"] = value

    return values, None


@admin_bp.get("/admin/dashboard")
@jwt_required()
@admin_required
def dashboard():
    """Return high-level platform statistics."""

    return jsonify({
        "statistics": {
            "users": db.session.scalar(
                select(func.count(User.id))
            ),
            "active_users": db.session.scalar(
                select(func.count(User.id)).where(User.is_active.is_(True))
            ),
            "destinations": db.session.scalar(
                select(func.count(Destination.id))
            ),
            "accommodations": db.session.scalar(
                select(func.count(Accommodation.id))
            ),
            "itineraries": db.session.scalar(
                select(func.count(Itinerary.id))
            ),
        }
    }), 200


# ---------------------------------------------------------
# Destination management
# ---------------------------------------------------------

@admin_bp.get("/admin/destinations")
@jwt_required()
@admin_required
def admin_list_destinations():
    destinations = db.session.scalars(
        select(Destination)
        .where(Destination.country == "Kenya")
        .order_by(Destination.name.asc())
    ).all()

    return jsonify({
        "count": len(destinations),
        "destinations": [
            serialize_destination(item) for item in destinations
        ],
    }), 200


@admin_bp.post("/admin/destinations")
@jwt_required()
@admin_required
def admin_create_destination():
    data = json_body()
    if data is None:
        return jsonify({"error": "A JSON request body is required."}), 400

    values, error = validate_destination(data)
    if error:
        return jsonify({"error": error}), 400

    destination = Destination(country="Kenya", **values)

    try:
        db.session.add(destination)
        db.session.commit()
        return jsonify({
            "message": "Destination created successfully.",
            "destination": serialize_destination(destination),
        }), 201
    except SQLAlchemyError:
        db.session.rollback()
        return jsonify({"error": "Unable to create destination."}), 500


@admin_bp.patch("/admin/destinations/<int:destination_id>")
@jwt_required()
@admin_required
def admin_update_destination(destination_id):
    destination = db.session.get(Destination, destination_id)

    if destination is None or destination.country != "Kenya":
        return jsonify({"error": "Destination not found."}), 404

    data = json_body()
    if data is None:
        return jsonify({"error": "A JSON request body is required."}), 400

    values, error = validate_destination(data, destination)
    if error:
        return jsonify({"error": error}), 400

    for field, value in values.items():
        setattr(destination, field, value)

    try:
        db.session.commit()
        return jsonify({
            "message": "Destination updated successfully.",
            "destination": serialize_destination(destination),
        }), 200
    except SQLAlchemyError:
        db.session.rollback()
        return jsonify({"error": "Unable to update destination."}), 500


@admin_bp.delete("/admin/destinations/<int:destination_id>")
@jwt_required()
@admin_required
def admin_delete_destination(destination_id):
    destination = db.session.get(Destination, destination_id)

    if destination is None or destination.country != "Kenya":
        return jsonify({"error": "Destination not found."}), 404

    try:
        db.session.delete(destination)
        db.session.commit()
        return jsonify({"message": "Destination deleted successfully."}), 200
    except SQLAlchemyError:
        db.session.rollback()
        return jsonify({"error": "Unable to delete destination."}), 500


# ---------------------------------------------------------
# Accommodation management
# ---------------------------------------------------------

@admin_bp.get("/admin/accommodations")
@jwt_required()
@admin_required
def admin_list_accommodations():
    items = db.session.scalars(
        select(Accommodation)
        .join(Destination)
        .where(Destination.country == "Kenya")
        .order_by(Accommodation.name.asc())
    ).all()

    return jsonify({
        "count": len(items),
        "accommodations": [
            serialize_accommodation(item) for item in items
        ],
    }), 200


@admin_bp.post("/admin/accommodations")
@jwt_required()
@admin_required
def admin_create_accommodation():
    data = json_body()
    if data is None:
        return jsonify({"error": "A JSON request body is required."}), 400

    values, error = validate_accommodation(data)
    if error:
        return jsonify({"error": error}), 400

    item = Accommodation(**values)

    try:
        db.session.add(item)
        db.session.commit()
        return jsonify({
            "message": "Accommodation created successfully.",
            "accommodation": serialize_accommodation(item),
        }), 201
    except SQLAlchemyError:
        db.session.rollback()
        return jsonify({"error": "Unable to create accommodation."}), 500


@admin_bp.patch("/admin/accommodations/<int:accommodation_id>")
@jwt_required()
@admin_required
def admin_update_accommodation(accommodation_id):
    item = db.session.get(Accommodation, accommodation_id)

    if item is None or item.destination.country != "Kenya":
        return jsonify({"error": "Accommodation not found."}), 404

    data = json_body()
    if data is None:
        return jsonify({"error": "A JSON request body is required."}), 400

    values, error = validate_accommodation(data, item)
    if error:
        return jsonify({"error": error}), 400

    for field, value in values.items():
        setattr(item, field, value)

    try:
        db.session.commit()
        return jsonify({
            "message": "Accommodation updated successfully.",
            "accommodation": serialize_accommodation(item),
        }), 200
    except SQLAlchemyError:
        db.session.rollback()
        return jsonify({"error": "Unable to update accommodation."}), 500


@admin_bp.delete("/admin/accommodations/<int:accommodation_id>")
@jwt_required()
@admin_required
def admin_delete_accommodation(accommodation_id):
    item = db.session.get(Accommodation, accommodation_id)

    if item is None or item.destination.country != "Kenya":
        return jsonify({"error": "Accommodation not found."}), 404

    try:
        db.session.delete(item)
        db.session.commit()
        return jsonify({
            "message": "Accommodation deleted successfully."
        }), 200
    except SQLAlchemyError:
        db.session.rollback()
        return jsonify({"error": "Unable to delete accommodation."}), 500


# ---------------------------------------------------------
# User management
# ---------------------------------------------------------

@admin_bp.get("/admin/users")
@jwt_required()
@admin_required
def admin_list_users():
    users = db.session.scalars(
        select(User).order_by(User.created_at.desc())
    ).all()

    return jsonify({
        "count": len(users),
        "users": [
            {
                "id": user.id,
                "full_name": user.full_name,
                "email": user.email,
                "role": user.role.name,
                "is_active": user.is_active,
                "created_at": (
                    user.created_at.isoformat()
                    if user.created_at else None
                ),
            }
            for user in users
        ],
    }), 200


@admin_bp.patch("/admin/users/<int:user_id>")
@jwt_required()
@admin_required
def admin_update_user(user_id):
    user = db.session.get(User, user_id)

    if user is None:
        return jsonify({"error": "User not found."}), 404

    data = json_body()
    if data is None or not isinstance(data.get("is_active"), bool):
        return jsonify({
            "error": "Provide is_active as true or false."
        }), 400

    current_admin_id = int(get_jwt_identity())

    if user.id == current_admin_id and not data["is_active"]:
        return jsonify({
            "error": "You cannot deactivate your own administrator account."
        }), 400

    if user.role.name == "admin" and not data["is_active"]:
        active_admins = db.session.scalar(
            select(func.count(User.id))
            .join(Role)
            .where(Role.name == "admin", User.is_active.is_(True))
        )

        if active_admins <= 1:
            return jsonify({
                "error": "The last active administrator cannot be deactivated."
            }), 400

    user.is_active = data["is_active"]

    try:
        db.session.commit()
        return jsonify({
            "message": "User account updated successfully.",
            "user": {
                "id": user.id,
                "full_name": user.full_name,
                "email": user.email,
                "role": user.role.name,
                "is_active": user.is_active,
            },
        }), 200
    except SQLAlchemyError:
        db.session.rollback()
        return jsonify({"error": "Unable to update user account."}), 500


# ---------------------------------------------------------
# Transport option management
# ---------------------------------------------------------

def validate_transport_option(data, item=None):
    """Validate a transport option for creation or partial update."""
    values = {}
    fields = {
        "provider": (150, True),
        "origin": (150, True),
        "destination": (150, True),
        "departure_time": (20, False),
        "arrival_time": (20, False),
        "notes": (5000, False),
    }

    for field, (maximum, required) in fields.items():
        if field not in data and item is not None:
            continue

        value, error = optional_text(
            data, field, maximum, required=required
        )
        if error:
            return None, error
        values[field] = value

    if "transport_type" in data or item is None:
        transport_type, error = optional_text(
            data, "transport_type", 30, required=True
        )
        if error:
            return None, error

        if transport_type not in {"flight", "bus", "sgr"}:
            return None, "transport_type must be flight, bus or sgr."

        values["transport_type"] = transport_type

    if "estimated_fare" in data or item is None:
        fare, error = optional_money(data, "estimated_fare")
        if error:
            return None, error
        values["estimated_fare"] = fare

    if "duration_minutes" in data or item is None:
        duration = data.get("duration_minutes")

        if duration is None or duration == "":
            values["duration_minutes"] = None
        elif isinstance(duration, bool):
            return None, "duration_minutes must be a positive integer."
        else:
            try:
                duration = int(duration)
                if duration <= 0:
                    raise ValueError
            except (TypeError, ValueError):
                return None, "duration_minutes must be a positive integer."
            values["duration_minutes"] = duration

    if "booking_url" in data:
        value, error = optional_url(data, "booking_url")
        if error:
            return None, error
        values["booking_url"] = value

    if "image_url" in data:
        value, error = optional_url(data, "image_url")
        if error:
            return None, error
        values["image_url"] = value

    if "is_active" in data:
        value, error = optional_boolean(data, "is_active")
        if error:
            return None, error
        values["is_active"] = value
    elif item is None:
        values["is_active"] = True

    origin = values.get("origin", item.origin if item else None)
    destination = values.get(
        "destination", item.destination if item else None
    )

    if origin and destination and origin.casefold() == destination.casefold():
        return None, "Origin and destination must be different."

    is_active = values.get(
        "is_active", item.is_active if item else True
    )
    booking_url = values.get(
        "booking_url", item.booking_url if item else None
    )

    if is_active and not booking_url:
        return None, "An active transport option must have a booking URL."

    return values, None


def serialize_admin_transport(item):
    """Serialize a transport option for administrator management."""
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
        "duration_minutes": item.duration_minutes,
        "departure_time": item.departure_time,
        "arrival_time": item.arrival_time,
        "booking_url": item.booking_url,
        "image_url": item.image_url,
        "notes": item.notes,
        "is_active": item.is_active,
    }


@admin_bp.get("/admin/transport")
@jwt_required()
@admin_required
def admin_list_transport():
    """List all transport options for administrators."""
    items = db.session.scalars(
        select(TransportOption).order_by(
            TransportOption.created_at.desc()
        )
    ).all()

    return jsonify({
        "count": len(items),
        "transport_options": [
            serialize_admin_transport(item) for item in items
        ],
    }), 200


@admin_bp.post("/admin/transport")
@jwt_required()
@admin_required
def admin_create_transport():
    """Create a transport option."""
    data = json_body()
    if data is None:
        return jsonify({"error": "A JSON request body is required."}), 400

    values, error = validate_transport_option(data)
    if error:
        return jsonify({"error": error}), 400

    item = TransportOption(**values)

    try:
        db.session.add(item)
        db.session.commit()
        return jsonify({
            "message": "Transport option created successfully.",
            "transport_option": serialize_admin_transport(item),
        }), 201
    except SQLAlchemyError:
        db.session.rollback()
        return jsonify({
            "error": "Unable to create transport option."
        }), 500


@admin_bp.patch("/admin/transport/<int:transport_id>")
@jwt_required()
@admin_required
def admin_update_transport(transport_id):
    """Update a transport option, including its active status."""
    item = db.session.get(TransportOption, transport_id)

    if item is None:
        return jsonify({"error": "Transport option not found."}), 404

    data = json_body()
    if data is None:
        return jsonify({"error": "A JSON request body is required."}), 400

    values, error = validate_transport_option(data, item)
    if error:
        return jsonify({"error": error}), 400

    for field, value in values.items():
        setattr(item, field, value)

    try:
        db.session.commit()
        return jsonify({
            "message": "Transport option updated successfully.",
            "transport_option": serialize_admin_transport(item),
        }), 200
    except SQLAlchemyError:
        db.session.rollback()
        return jsonify({
            "error": "Unable to update transport option."
        }), 500
