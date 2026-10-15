"""Health-check endpoint."""

from flask import Blueprint, jsonify

health_bp = Blueprint("health", __name__)


@health_bp.get("/health")
def health_check():
    """Return the API status."""
    return jsonify({
        "status": "ok",
        "service": "Safari Planner API",
    }), 200
