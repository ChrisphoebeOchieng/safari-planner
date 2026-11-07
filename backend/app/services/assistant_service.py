"""Gemini-powered travel assistant for Safari Planner."""

import json
import math

from flask import current_app
from google import genai
from google.genai import types

from .recommendation_service import recommend_destinations


TRAVEL_STYLES = [
    "Wildlife & Safari",
    "Nature & Adventure",
    "Coastal Escape",
    "Culture & Heritage",
    "Relaxation & Wellness",
]


def extract_travel_preferences(message):
    """Use Gemini to understand a traveller's natural-language request."""
    api_key = current_app.config.get("GEMINI_API_KEY")

    if not api_key:
        raise RuntimeError("Gemini API key is not configured.")

    client = genai.Client(api_key=api_key)
    model = current_app.config.get(
        "GEMINI_MODEL",
        "gemini-2.5-flash",
    )

    prompt = f"""
You are the travel preference interpreter for Safari Planner,
a travel planning platform focused exclusively on Kenya.

Read the traveller's message and extract their travel preferences.

Allowed travel styles:
{json.dumps(TRAVEL_STYLES)}

Return ONLY valid JSON with these exact keys:
- travel_style: one allowed style or null
- interests: an array of short interest keywords
- budget: numeric total budget in Kenyan shillings, or null
- duration_days: integer between 1 and 30
- assistant_message: a friendly, natural acknowledgement of the
  traveller's request, maximum 45 words.

Rules:
- Understand natural language, including informal wording.
- Recognise KES, KSh and Kenyan shilling amounts.
- Convert amounts such as 60k into 60000.
- Do not invent a budget or duration if the traveller did not provide one.
- Use duration_days = 1 when no duration is specified.
- Do not invent travel preferences.
- Do not recommend destinations or invent travel prices.
- The platform will retrieve destination recommendations separately.

Traveller's message:
{message}
"""

    response = client.models.generate_content(
        model=model,
        contents=prompt,
        config=types.GenerateContentConfig(
            response_mime_type="application/json",
            temperature=0.2,
        ),
    )

    if not response.text:
        raise RuntimeError("Gemini returned an empty response.")

    preferences = json.loads(response.text)

    if not isinstance(preferences, dict):
        raise ValueError("Gemini returned an invalid response.")

    style = preferences.get("travel_style")
    if style not in TRAVEL_STYLES:
        style = None

    interests = preferences.get("interests", [])
    if not isinstance(interests, list):
        interests = []

    interests = list(dict.fromkeys(
        item.strip().lower()
        for item in interests
        if isinstance(item, str) and item.strip()
    ))[:10]

    try:
        duration_days = int(preferences.get("duration_days", 1))
    except (TypeError, ValueError):
        duration_days = 1

    duration_days = max(1, min(duration_days, 30))

    budget = preferences.get("budget")
    try:
        budget = float(budget) if budget is not None else None
        if budget is not None and (
            not math.isfinite(budget) or budget < 0
        ):
            budget = None
    except (TypeError, ValueError):
        budget = None

    assistant_message = preferences.get("assistant_message")
    if not isinstance(assistant_message, str) or not assistant_message.strip():
        assistant_message = "I've understood your travel preferences. Let's explore some Kenyan destinations."

    return {
        "travel_style": style,
        "interests": interests,
        "budget": budget,
        "duration_days": duration_days,
        "assistant_message": assistant_message.strip(),
    }


def create_travel_assistance(message):
    """Generate personalised assistance using Gemini and destination data."""
    preferences = extract_travel_preferences(message)

    recommendations = recommend_destinations(
        travel_style=preferences["travel_style"],
        interests=preferences["interests"],
        budget=preferences["budget"],
        duration_days=preferences["duration_days"],
        limit=6,
    )

    if recommendations:
        assistant_message = preferences["assistant_message"]
    else:
        assistant_message = (
            preferences["assistant_message"]
            + " I couldn't find destinations matching all those preferences. "
            "Try adjusting your budget or travel style."
        )

    return {
        "message": assistant_message,
        "preferences": {
            "travel_style": preferences["travel_style"],
            "interests": preferences["interests"],
            "budget": preferences["budget"],
            "duration_days": preferences["duration_days"],
        },
        "recommendations": recommendations,
        "method": "Gemini generative AI with Kenyan destination ranking",
    }
