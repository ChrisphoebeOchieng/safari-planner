"""Destination recommendation API."""

from flask import Blueprint, jsonify, request

from ..services.recommendation_service import recommend_destinations

recommendations_bp = Blueprint("recommendations", __name__)


@recommendations_bp.get("/recommendations")
def get_recommendations():
    """Return ranked Kenyan destinations based on travel preferences."""
    travel_style = request.args.get("travel_style", "").strip() or None
    interests = request.args.getlist("interest")
    budget = request.args.get("budget")
    duration_days = request.args.get("duration_days", 1)
    limit = request.args.get("limit", 6)

    if budget not in (None, ""):
        try:
            if float(budget) < 0:
                return jsonify({"error": "Budget cannot be negative."}), 400
        except ValueError:
            return jsonify({"error": "Budget must be a valid number."}), 400

    recommendations = recommend_destinations(
        travel_style=travel_style,
        interests=interests,
        budget=budget,
        duration_days=duration_days,
        limit=limit,
    )

    return jsonify({
        "count": len(recommendations),
        "recommendations": recommendations,
        "method": "content-based destination scoring",
    }), 200
