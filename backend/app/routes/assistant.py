"""Safari travel assistant API."""

from flask import Blueprint, current_app, jsonify, request

from ..services.assistant_service import create_travel_assistance

assistant_bp = Blueprint("assistant", __name__)


@assistant_bp.post("/assistant")
def travel_assistant():
    """Return Gemini-powered travel assistance."""
    data = request.get_json(silent=True) or {}
    message = data.get("message", "")

    if not isinstance(message, str) or not message.strip():
        return jsonify({
            "error": "Please describe the trip you want to take."
        }), 400

    if len(message) > 2000:
        return jsonify({
            "error": "Your message must be 2,000 characters or fewer."
        }), 400

    try:
        result = create_travel_assistance(message.strip())
        return jsonify(result), 200
    except Exception:
        current_app.logger.exception("Safari assistant request failed.")
        return jsonify({
            "error": "The AI assistant is temporarily unavailable. Please try again."
        }), 503
