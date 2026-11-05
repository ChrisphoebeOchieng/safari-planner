"""Content-based destination recommendations for Safari Planner."""

from decimal import Decimal, InvalidOperation

from ..extensions import db
from ..models import Destination


TRAVEL_STYLE_CATEGORIES = {
    "Wildlife & Safari": ["wildlife & safari"],
    "Nature & Adventure": ["nature & adventure"],
    "Coastal Escape": ["coastal escape"],
    "Culture & Heritage": ["culture & heritage"],
    "Relaxation & Wellness": ["coastal escape", "nature & adventure"],
}


def recommend_destinations(travel_style=None, interests=None, budget=None,
                           duration_days=1, limit=6):
    """Rank Kenyan destinations using category, text and budget relevance."""
    interests = interests or []

    if isinstance(interests, str):
        interests = [interests]

    normalized_interests = [
        item.strip().lower()
        for item in interests
        if isinstance(item, str) and item.strip()
    ]

    try:
        duration_days = max(1, int(duration_days))
    except (TypeError, ValueError):
        duration_days = 1

    try:
        budget_value = Decimal(str(budget)) if budget not in (None, "") else None
        if budget_value is not None and (
            not budget_value.is_finite() or budget_value < 0
        ):
            budget_value = None
    except (InvalidOperation, TypeError, ValueError):
        budget_value = None

    destinations = db.session.scalars(
        db.select(Destination).where(Destination.country == "Kenya")
    ).all()

    preferred_categories = [
        value.lower()
        for value in TRAVEL_STYLE_CATEGORIES.get(travel_style, [])
    ]

    results = []

    for destination in destinations:
        score = 0
        reasons = []

        category = (destination.category or "").lower()
        description = (destination.description or "").lower()
        name = (destination.name or "").lower()
        searchable_text = f"{name} {category} {description}"

        if category in preferred_categories:
            score += 40
            reasons.append("Matches your preferred travel style")

        matched_interests = [
            interest for interest in normalized_interests
            if interest in searchable_text
        ]

        if matched_interests:
            score += min(40, len(matched_interests) * 20)
            reasons.append(
                "Matches your interests: " + ", ".join(matched_interests)
            )

        if destination.is_featured:
            score += 5
            reasons.append("Featured Kenyan destination")

        daily_cost = (
            Decimal(str(destination.estimated_daily_cost))
            if destination.estimated_daily_cost is not None
            else None
        )

        estimated_total = (
            daily_cost * duration_days if daily_cost is not None else None
        )

        if budget_value is not None and daily_cost is not None:
            if estimated_total > budget_value:
                continue

            score += 15
            reasons.append("Estimated destination cost fits your budget")

        if not reasons:
            reasons.append("Explore this Kenyan destination")

        results.append({
            "id": destination.id,
            "name": destination.name,
            "country": destination.country,
            "region": destination.region,
            "category": destination.category,
            "description": destination.description,
            "image_url": destination.image_url,
            "estimated_daily_cost_kes": (
                str(daily_cost) if daily_cost is not None else None
            ),
            "estimated_total_cost_kes": (
                str(estimated_total) if estimated_total is not None else None
            ),
            "recommendation_score": min(score, 100),
            "reasons": reasons,
        })

    results.sort(
        key=lambda item: (
            item["recommendation_score"],
            item["name"],
        ),
        reverse=True,
    )

    try:
        limit = max(1, min(int(limit), 20))
    except (TypeError, ValueError):
        limit = 6

    return results[:limit]
