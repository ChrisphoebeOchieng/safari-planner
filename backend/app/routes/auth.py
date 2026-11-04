"""Registration, login, logout and account endpoints."""

from flask import Blueprint, current_app, jsonify, request
from flask_jwt_extended import (
    create_access_token,
    get_jwt,
    get_jwt_identity,
    jwt_required,
)
from sqlalchemy import func, select
from sqlalchemy.exc import SQLAlchemyError

from ..extensions import db
from ..models import Role, TokenBlocklist, User

auth_bp = Blueprint("auth", __name__)


def serialize_user(user):
    """Return safe public account information."""
    return {
        "id": user.id,
        "full_name": user.full_name,
        "email": user.email,
        "role": user.role.name,
    }


@auth_bp.post("/auth/register")
def register():
    """Register a new traveler account."""
    data = request.get_json(silent=True)

    if not isinstance(data, dict):
        return jsonify({"error": "A JSON request body is required."}), 400

    full_name = data.get("full_name")
    email = data.get("email")
    password = data.get("password")

    if not isinstance(full_name, str) or not full_name.strip():
        return jsonify({"error": "Full name is required."}), 400

    full_name = full_name.strip()

    if len(full_name) > 120:
        return jsonify({"error": "Full name must be 120 characters or fewer."}), 400

    if not isinstance(email, str) or not email.strip():
        return jsonify({"error": "Email address is required."}), 400

    email = email.strip().lower()

    if len(email) > 255 or "@" not in email:
        return jsonify({"error": "Provide a valid email address."}), 400

    if not isinstance(password, str) or len(password) < 8:
        return jsonify({"error": "Password must contain at least 8 characters."}), 400

    if len(password) > 128:
        return jsonify({"error": "Password must be 128 characters or fewer."}), 400

    existing_user = db.session.scalar(
        select(User).where(func.lower(User.email) == email)
    )

    if existing_user:
        return jsonify({"error": "An account with this email already exists."}), 409

    traveler_role = db.session.scalar(
        select(Role).where(Role.name == "traveler")
    )

    if traveler_role is None:
        current_app.logger.error("The traveler role is missing.")
        return jsonify({"error": "Account registration is temporarily unavailable."}), 500

    try:
        user = User(
            full_name=full_name,
            email=email,
            role_id=traveler_role.id,
        )
        user.set_password(password)

        db.session.add(user)
        db.session.commit()

        token = create_access_token(identity=str(user.id))

        return jsonify({
            "message": "Account created successfully.",
            "user": serialize_user(user),
            "access_token": token,
        }), 201

    except SQLAlchemyError:
        db.session.rollback()
        current_app.logger.exception("Account registration failed.")
        return jsonify({"error": "Unable to create your account right now."}), 500


@auth_bp.post("/auth/login")
def login():
    """Authenticate an existing traveler."""
    data = request.get_json(silent=True)

    if not isinstance(data, dict):
        return jsonify({"error": "A JSON request body is required."}), 400

    email = data.get("email")
    password = data.get("password")

    if not isinstance(email, str) or not isinstance(password, str):
        return jsonify({"error": "Email and password are required."}), 400

    email = email.strip().lower()

    user = db.session.scalar(
        select(User).where(func.lower(User.email) == email)
    )

    if user is None or not user.check_password(password):
        return jsonify({"error": "Invalid email or password."}), 401

    if not user.is_active:
        return jsonify({"error": "This account has been deactivated."}), 403

    token = create_access_token(identity=str(user.id))

    return jsonify({
        "message": "Login successful.",
        "user": serialize_user(user),
        "access_token": token,
    }), 200


@auth_bp.post("/auth/logout")
@jwt_required()
def logout():
    """Revoke the current access token."""
    token_data = get_jwt()

    try:
        revoked_token = TokenBlocklist(jti=token_data["jti"])
        db.session.add(revoked_token)
        db.session.commit()

        return jsonify({"message": "Logged out successfully."}), 200

    except SQLAlchemyError:
        db.session.rollback()
        current_app.logger.exception("Token revocation failed.")
        return jsonify({"error": "Unable to log out right now."}), 500


@auth_bp.get("/auth/me")
@jwt_required()
def current_user():
    """Return the currently authenticated account."""
    try:
        user_id = int(get_jwt_identity())
    except (TypeError, ValueError):
        return jsonify({"error": "Invalid account identity."}), 401

    user = db.session.get(User, user_id)

    if user is None or not user.is_active:
        return jsonify({"error": "Account not found or inactive."}), 401

    return jsonify({"user": serialize_user(user)}), 200
