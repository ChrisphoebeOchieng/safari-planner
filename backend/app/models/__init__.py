"""Database models for Safari Planner."""

from datetime import datetime, timezone
from decimal import Decimal

from werkzeug.security import check_password_hash, generate_password_hash

from ..extensions import db


def utc_now():
    """Return the current UTC timestamp."""
    return datetime.now(timezone.utc)


class Role(db.Model):
    """A role assigned to a registered user."""

    __tablename__ = "roles"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(50), unique=True, nullable=False, index=True)
    description = db.Column(db.String(255))
    created_at = db.Column(
        db.DateTime(timezone=True), default=utc_now, nullable=False
    )

    users = db.relationship("User", back_populates="role")


class User(db.Model):
    """A registered Safari Planner user."""

    __tablename__ = "users"

    id = db.Column(db.Integer, primary_key=True)
    full_name = db.Column(db.String(120), nullable=False)
    email = db.Column(db.String(255), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(255), nullable=False)
    role_id = db.Column(db.Integer, db.ForeignKey("roles.id"), nullable=False)
    is_active = db.Column(db.Boolean, default=True, nullable=False)
    created_at = db.Column(
        db.DateTime(timezone=True), default=utc_now, nullable=False
    )

    role = db.relationship("Role", back_populates="users")
    itineraries = db.relationship(
        "Itinerary",
        back_populates="user",
        cascade="all, delete-orphan",
    )
    saved_destinations = db.relationship(
        "SavedDestination",
        back_populates="user",
        cascade="all, delete-orphan",
    )

    def set_password(self, password):
        """Hash a password before storing it."""
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        """Verify a password against its stored hash."""
        return check_password_hash(self.password_hash, password)


class Destination(db.Model):
    """A destination available for travel planning."""

    __tablename__ = "destinations"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(150), nullable=False, index=True)
    country = db.Column(db.String(100), nullable=False)
    region = db.Column(db.String(120))
    description = db.Column(db.Text)
    category = db.Column(db.String(80))
    image_url = db.Column(db.String(500))
    estimated_daily_cost = db.Column(db.Numeric(10, 2))
    is_featured = db.Column(db.Boolean, default=False, nullable=False)
    created_at = db.Column(
        db.DateTime(timezone=True), default=utc_now, nullable=False
    )

    itineraries = db.relationship("Itinerary", back_populates="destination")
    saved_by = db.relationship("SavedDestination", back_populates="destination")


class Itinerary(db.Model):
    """A travel itinerary belonging to a user."""

    __tablename__ = "itineraries"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(
        db.Integer,
        db.ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    destination_id = db.Column(
        db.Integer,
        db.ForeignKey("destinations.id", ondelete="SET NULL"),
    )
    title = db.Column(db.String(180), nullable=False)
    start_date = db.Column(db.Date)
    end_date = db.Column(db.Date)
    budget = db.Column(
        db.Numeric(12, 2),
        default=Decimal("0.00"),
        nullable=False,
    )
    travel_style = db.Column(db.String(80))
    status = db.Column(db.String(30), default="planned", nullable=False)
    created_at = db.Column(
        db.DateTime(timezone=True), default=utc_now, nullable=False
    )
    updated_at = db.Column(
        db.DateTime(timezone=True),
        default=utc_now,
        onupdate=utc_now,
        nullable=False,
    )

    user = db.relationship("User", back_populates="itineraries")
    destination = db.relationship("Destination", back_populates="itineraries")
    activities = db.relationship(
        "ItineraryActivity",
        back_populates="itinerary",
        cascade="all, delete-orphan",
        order_by=lambda: (
            ItineraryActivity.day_number,
            ItineraryActivity.sort_order,
        ),
    )


class ItineraryActivity(db.Model):
    """An activity scheduled within an itinerary."""

    __tablename__ = "itinerary_activities"

    id = db.Column(db.Integer, primary_key=True)
    itinerary_id = db.Column(
        db.Integer,
        db.ForeignKey("itineraries.id", ondelete="CASCADE"),
        nullable=False,
    )
    day_number = db.Column(db.Integer, default=1, nullable=False)
    title = db.Column(db.String(180), nullable=False)
    description = db.Column(db.Text)
    location = db.Column(db.String(180))
    start_time = db.Column(db.Time)
    duration_minutes = db.Column(db.Integer)
    estimated_cost = db.Column(
        db.Numeric(10, 2),
        default=Decimal("0.00"),
        nullable=False,
    )
    sort_order = db.Column(db.Integer, default=0, nullable=False)
    created_at = db.Column(
        db.DateTime(timezone=True), default=utc_now, nullable=False
    )

    itinerary = db.relationship("Itinerary", back_populates="activities")


class SavedDestination(db.Model):
    """A destination saved by a user."""

    __tablename__ = "saved_destinations"

    __table_args__ = (
        db.UniqueConstraint(
            "user_id",
            "destination_id",
            name="uq_saved_destination_user_destination",
        ),
    )

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(
        db.Integer,
        db.ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    destination_id = db.Column(
        db.Integer,
        db.ForeignKey("destinations.id", ondelete="CASCADE"),
        nullable=False,
    )
    saved_at = db.Column(
        db.DateTime(timezone=True), default=utc_now, nullable=False
    )

    user = db.relationship("User", back_populates="saved_destinations")
    destination = db.relationship("Destination", back_populates="saved_by")
