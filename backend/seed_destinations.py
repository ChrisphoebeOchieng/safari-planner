"""Seed initial Kenyan destinations for Safari Planner."""

from sqlalchemy import select

from app import create_app
from app.extensions import db
from app.models import Destination

DESTINATIONS = [
    {
        "name": "Maasai Mara",
        "region": "Narok County",
        "category": "Wildlife & Safari",
        "description": "Explore Kenya's iconic savannah and wildlife experiences.",
        "image_url": "https://images.unsplash.com/photo-1516426122078-c23e76319801?auto=format&fit=crop&w=900&q=85",
        "is_featured": True,
    },
    {
        "name": "Lake Bogoria",
        "region": "Baringo County",
        "category": "Nature & Adventure",
        "description": "Discover Rift Valley scenery, geothermal features and birdlife.",
        "image_url": "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=900&q=85",
        "is_featured": True,
    },
    {
        "name": "Diani Beach",
        "region": "Kwale County",
        "category": "Coastal Escape",
        "description": "Enjoy a coastal getaway along Kenya's Indian Ocean shoreline.",
        "image_url": "https://images.unsplash.com/photo-1510414842594-a61c69b5ae57?auto=format&fit=crop&w=900&q=85",
        "is_featured": True,
    },
    {
        "name": "Amboseli National Park",
        "region": "Kajiado County",
        "category": "Wildlife & Safari",
        "description": "Experience open plains and views of Mount Kilimanjaro.",
        "image_url": "https://images.unsplash.com/photo-1516026672322-bc52d61a55d5?auto=format&fit=crop&w=900&q=85",
        "is_featured": True,
    },
    {
        "name": "Lamu Old Town",
        "region": "Lamu County",
        "category": "Culture & Heritage",
        "description": "Explore Swahili heritage, historic streets and island culture.",
        "image_url": "https://images.unsplash.com/photo-1533105079780-92b9be482077?auto=format&fit=crop&w=900&q=85",
        "is_featured": False,
    },
    {
        "name": "Mount Kenya",
        "region": "Central Kenya",
        "category": "Nature & Adventure",
        "description": "Discover mountain scenery and outdoor experiences.",
        "image_url": "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=900&q=85",
        "is_featured": False,
    },
]


def seed_destinations():
    """Insert or update the initial destination records."""
    app = create_app()

    with app.app_context():
        for item in DESTINATIONS:
            destination = db.session.scalar(
                select(Destination).where(
                    Destination.name == item["name"],
                    Destination.country == "Kenya",
                )
            )

            if destination is None:
                destination = Destination(
                    name=item["name"],
                    country="Kenya",
                )
                db.session.add(destination)

            for field, value in item.items():
                setattr(destination, field, value)

        db.session.commit()

        total = db.session.scalar(
            select(db.func.count()).select_from(Destination)
        )
        print(f"Destination seeding complete. Total records: {total}")


if __name__ == "__main__":
    seed_destinations()
