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

INTEREST_KEYWORDS = {
    "wildlife": ["wildlife", "animals", "lion", "elephant", "safari", "game drive"],
    "beach": ["beach", "coast", "ocean", "sea", "swimming"],
    "birdlife": ["bird", "birds", "birdlife", "flamingo"],
    "adventure": ["adventure", "hiking", "climbing", "trekking", "rafting"],
    "nature": ["nature", "forest", "landscape", "mountain", "waterfall"],
    "culture": ["culture", "heritage", "community", "traditional", "history"],
    "relaxation": ["relaxation", "wellness", "spa", "peaceful", "retreat"],
}


def _normalise_interests(interests):
    """Clean interests and remove duplicates while preserving their order."""
    if isinstance(interests, str):
        interests = interests.split(",")

    cleaned = []
    seen = set()

    for item in interests or []:
        if not isinstance(item, str):
            continue

        interest = item.strip().lower()

        if interest and interest not in seen:
            cleaned.append(interest)
            seen.add(interest)

    return cleaned


def _interest_matches(interest, searchable_text):
    """Check direct and related keyword matches for an interest."""
    keywords = INTEREST_KEYWORDS.get(interest, [interest])
    return any(keyword in searchable_text for keyword in keywords)


def recommend_destinations(
    travel_style=None,
    interests=None,
    budget=None,
    duration_days=1,
    limit=6,
):
    """Rank Kenyan destinations using travel preferences and budget."""
    normalized_interests = _normalise_interests(interests)

    try:
        duration_days = max(1, int(duration_days))
    except (TypeError, ValueError):
        duration_days = 1

    try:
        budget_value = (
            Decimal(str(budget))
            if budget not in (None, "")
            else None
        )

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

        direct_style_match = category in preferred_categories

        wildlife_keywords = (
            "wildlife", "safari", "birdlife", "flamingo",
            "elephant", "lion", "game drive",
        )

        related_style_match = (
            travel_style == "Wildlife & Safari"
            and any(
                keyword in searchable_text
                for keyword in wildlife_keywords
            )
        )

        if preferred_categories and not (
            direct_style_match or related_style_match
        ):
            continue

        if direct_style_match:
            score += 40
            reasons.append("Matches your preferred travel style")
        elif related_style_match:
            score += 30
            reasons.append("Offers wildlife and birdlife experiences")

        matched_interests = [
            interest
            for interest in normalized_interests
            if _interest_matches(interest, searchable_text)
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
            daily_cost * duration_days
            if daily_cost is not None
            else None
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
