"""Shared service for building travel itineraries."""

from datetime import timedelta
from decimal import Decimal

from ..models import Destination


# Initial itinerary suggestions. These are not confirmed bookings.
ACTIVITY_TEMPLATES = {
    "Wildlife & Safari": [
        [
            ("Morning", "Early wildlife exploration",
             "Plan a suitable early wildlife experience."),
            ("Afternoon", "Scenic landscape discovery",
             "Explore the surrounding landscape and allow time for rest."),
            ("Evening", "Relax and review the day",
             "Allow time for dinner and preparation for the next day."),
        ],
        [
            ("Morning", "Nature observation",
             "Choose a suitable outdoor or wildlife activity."),
            ("Afternoon", "Local attraction visit",
             "Explore a relevant attraction, allowing time for travel."),
            ("Evening", "Leisure time",
             "Keep the evening flexible for rest or optional activities."),
        ],
    ],
    "Nature & Adventure": [
        [
            ("Morning", "Outdoor exploration",
             "Plan a suitable nature walk or outdoor excursion."),
            ("Afternoon", "Scenic viewpoint",
             "Explore the area's scenery at a comfortable pace."),
            ("Evening", "Rest and prepare",
             "Allow time to rest and review the next day's plans."),
        ],
        [
            ("Morning", "Nature trail",
             "Choose a route suitable for your ability and local conditions."),
            ("Afternoon", "Explore local surroundings",
             "Allow time for photography, meals and transport."),
            ("Evening", "Relaxation",
             "Keep the evening available for rest."),
        ],
    ],
    "Coastal Escape": [
        [
            ("Morning", "Coastal discovery",
             "Plan a beach visit or suitable coastal activity."),
            ("Afternoon", "Local exploration",
             "Explore nearby places and allow time for lunch."),
            ("Evening", "Sunset and relaxation",
             "Keep the evening flexible for leisure."),
        ],
        [
            ("Morning", "Beach and nature time",
             "Choose an activity that suits local conditions."),
            ("Afternoon", "Local attraction",
             "Explore a nearby attraction where available."),
            ("Evening", "Leisure time",
             "Allow time to rest and prepare for the next day."),
        ],
    ],
    "Culture & Heritage": [
        [
            ("Morning", "Heritage discovery",
             "Plan a visit to a relevant cultural or historical attraction."),
            ("Afternoon", "Local culture and cuisine",
             "Explore local food and cultural experiences where available."),
            ("Evening", "Reflect and relax",
             "Keep time available for dinner and rest."),
        ],
        [
            ("Morning", "Historic site visit",
             "Choose a suitable heritage attraction."),
            ("Afternoon", "Local arts and culture",
             "Explore local crafts or cultural experiences where available."),
            ("Evening", "Leisure time",
             "Leave the schedule flexible."),
        ],
    ],
    "Relaxation & Wellness": [
        [
            ("Morning", "Slow morning",
             "Start with a relaxed breakfast and an unhurried morning."),
            ("Afternoon", "Leisure activity",
             "Choose a suitable relaxation or wellness experience."),
            ("Evening", "Unwind",
             "Keep the evening free for rest."),
        ],
        [
            ("Morning", "Gentle exploration",
             "Plan an easy activity at a comfortable pace."),
            ("Afternoon", "Rest and recharge",
             "Leave space for relaxation and meals."),
            ("Evening", "Personal time",
             "Keep the evening flexible."),
        ],
    ],
}

DEFAULT_ACTIVITIES = ACTIVITY_TEMPLATES["Nature & Adventure"]


def build_plan(preference, destination):
    """Build a structured itinerary from saved trip preferences."""
    day_count = (preference.end_date - preference.start_date).days + 1

    if not 1 <= day_count <= 30:
        raise ValueError("Itineraries must cover between 1 and 30 days.")

    templates = ACTIVITY_TEMPLATES.get(
        preference.travel_style,
        DEFAULT_ACTIVITIES,
    )

    days = []

    for index in range(day_count):
        activities_for_day = templates[index % len(templates)]
        current_date = preference.start_date + timedelta(days=index)

        activities = [
            {
                "time": time,
                "title": title,
                "description": description,
                "estimated_cost_kes": None,
            }
            for time, title, description in activities_for_day
        ]

        days.append({
            "day": index + 1,
            "date": current_date.isoformat(),
            "activities": activities,
        })

    budget = preference.budget
    daily_budget = (
        (Decimal(str(budget)) / Decimal(day_count)).quantize(
            Decimal("0.01")
        )
        if budget is not None
        else None
    )

    destination_details = None
    if destination is not None:
        destination_details = {
            "id": destination.id,
            "country": destination.country,
            "region": destination.region,
            "category": destination.category,
            "image_url": destination.image_url,
        }

    return {
        "destination": preference.destination,
        "destination_details": destination_details,
        "travel_style": preference.travel_style,
        "start_date": preference.start_date.isoformat(),
        "end_date": preference.end_date.isoformat(),
        "duration_days": day_count,
        "budget_kes": str(budget) if budget is not None else None,
        "daily_budget_guidance_kes": (
            str(daily_budget) if daily_budget is not None else None
        ),
        "days": days,
        "notice": (
            "Activities are planning suggestions, not confirmed bookings. "
            "Verify availability, opening times, transport, safety conditions "
            "and current prices with relevant providers. Daily budget guidance "
            "is a simple allocation of your stated budget, not a price quote."
        ),
    }
