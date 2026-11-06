"""Seed verified accommodation listings for Kenyan destinations."""

from sqlalchemy import select

from app import create_app
from app.extensions import db
from app.models import Accommodation, Destination


ACCOMMODATIONS = [
    {
        "destination": "Maasai Mara",
        "name": "Mara Silalei Camp",
        "type": "Tented Camp",
        "location": "Maasai Mara, Narok County",
        "description": "Family-run safari camp with safari and family tents. Published low-season rates start at KES 7,000 per night for bed and breakfast.",
        "rate": 7000,
        "website": "https://marasilalei.co.ke/accommodation/",
        "featured": True,
    },
    {
        "destination": "Lake Bogoria",
        "name": "Lake Bogoria Spa Resort",
        "type": "Resort",
        "location": "Lake Bogoria, Baringo County",
        "description": "Resort accommodation near Lake Bogoria, with spa facilities and access to the Rift Valley landscape. Contact the property for current rates.",
        "rate": None,
        "website": "https://www.lakebogoria-hotel.com/",
        "image": "https://www.lakebogoria-hotel.com/assets/images/accommodation/1759382798-slider6.jpg",
        "featured": True,
    },
    {
        "destination": "Diani Beach",
        "name": "The Maji Beach Boutique Hotel",
        "type": "Boutique Hotel",
        "location": "Diani Beach, Kwale County",
        "description": "Beachfront boutique hotel with individually designed rooms and swimming pool facilities. Contact the property for current rates.",
        "rate": None,
        "website": "https://www.the-maji.com/",
        "image": "https://www.the-maji.com/wp-content/uploads/2025/11/The-Maji-HDR-52-scaled.jpg",
        "featured": True,
    },
    {
        "destination": "Diani Beach",
        "name": "Diani Blue",
        "type": "Beach Lodge",
        "location": "Diani Beach, Kwale County",
        "description": "Small beach lodge with Swahili-inspired rooms and a swimming pool. Contact the property for current rates.",
        "rate": None,
        "website": "https://www.dianiblue.com/",
        "image": "https://www.expertafrica.com/images/lodge/18538.jpg",
        "featured": False,
    },
    {
        "destination": "Amboseli National Park",
        "name": "Kilimanjaro Annex",
        "type": "Guest House",
        "location": "Amboseli National Park, Kajiado County",
        "description": "Kenya Wildlife Service accommodation. Published resident rate: KES 10,000 per night. Confirm current rates before travel.",
        "rate": 10000,
        "website": "https://reservations.kws.go.ke/location/amboseli-national-park",
        "image": "https://reservations.kws.go.ke/uploads/0000/26/2024/06/07/kilimanjaro-annex-2-kws.jpg",
        "featured": True,
    },
    {
        "destination": "Lamu Old Town",
        "name": "Jannat House",
        "type": "Guest House",
        "location": "Lamu Old Town, Lamu County",
        "description": "Restored Swahili houses in the heart of Lamu Old Town. Published room rates vary by room type.",
        "rate": 4152,
        "website": "https://jannatlamu.com/",
        "image": "https://jannatlamu.com/wp-content/uploads/2019/08/MA_IMG_2719-1024x683.jpg",
        "featured": True,
    },
    {
        "destination": "Mount Kenya",
        "name": "Sirimon Bandas",
        "type": "Mountain Accommodation",
        "location": "Mount Kenya National Park",
        "description": "Kenya Wildlife Service mountain accommodation. Published resident rate: KES 6,000 per night. Confirm current rates before travel.",
        "rate": 6000,
        "website": "https://reservations.kws.go.ke/location/mt-kenya",
        "image": "https://reservations.kws.go.ke/uploads/0000/26/2024/06/07/02042024-2125-edited.jpg",
        "featured": True,
    },
    {
        "destination": "Mount Kenya",
        "name": "Castle Forest Lodge",
        "type": "Forest Lodge",
        "location": "Mount Kenya Forest Reserve",
        "description": "Forest lodge listed by Kenya Forest Service among the accommodation facilities around Mount Kenya. Contact the property for current rates.",
        "rate": None,
        "website": "https://www.kenyaforestservice.org/ecotourism-in-mt-kenya-forest-reserve/",
        "featured": False,
    },
]


def seed_accommodations():
    """Insert or update accommodation listings."""
    app = create_app()

    with app.app_context():
        for item in ACCOMMODATIONS:
            destination = db.session.scalar(
                select(Destination).where(
                    Destination.name == item["destination"],
                    Destination.country == "Kenya",
                )
            )

            if destination is None:
                print(f"Skipped: destination not found: {item['destination']}")
                continue

            accommodation = db.session.scalar(
                select(Accommodation).where(
                    Accommodation.destination_id == destination.id,
                    Accommodation.name == item["name"],
                )
            )

            if accommodation is None:
                accommodation = Accommodation(
                    destination_id=destination.id,
                    name=item["name"],
                    accommodation_type=item["type"],
                )
                db.session.add(accommodation)

            accommodation.accommodation_type = item["type"]
            accommodation.location = item["location"]
            accommodation.description = item["description"]
            accommodation.estimated_nightly_rate = item["rate"]
            accommodation.website_url = item["website"]
            accommodation.image_url = item.get("image")
            accommodation.image_url = item.get("image")
            accommodation.is_featured = item["featured"]

        db.session.commit()

        total = db.session.scalar(
            select(db.func.count()).select_from(Accommodation)
        )
        print(f"Accommodation seeding complete. Total records: {total}")


if __name__ == "__main__":
    seed_accommodations()
