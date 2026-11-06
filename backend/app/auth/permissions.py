"""Authorization helpers for protected application routes."""

from functools import wraps

from flask import jsonify
from flask_jwt_extended import get_jwt_identity

from ..extensions import db
from ..models import User


def admin_required(view_function):
    """Allow access only to authenticated, active administrator accounts."""

    @wraps(view_function)
    def wrapped(*args, **kwargs):
        try:
            user_id = int(get_jwt_identity())
        except (TypeError, ValueError):
            return jsonify({"error": "Invalid account identity."}), 401

        user = db.session.get(User, user_id)

        if user is None or not user.is_active:
            return jsonify({"error": "Account not found or inactive."}), 401

        if user.role is None or user.role.name != "admin":
            return jsonify({"error": "Administrator access required."}), 403

        return view_function(*args, **kwargs)

    return wrapped
