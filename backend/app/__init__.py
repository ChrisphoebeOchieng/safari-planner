"""Safari Planner Flask application factory."""

from flask import Flask

from . import models
from .config import Config
from .extensions import cors, db, jwt, migrate
from .routes.accommodations import accommodations_bp
from .routes.admin import admin_bp
from .routes.auth import auth_bp
from .routes.destinations import destinations_bp
from .routes.health import health_bp
from .routes.itineraries import itineraries_bp
from .routes.recommendations import recommendations_bp
from .routes.trip_preferences import trip_preferences_bp


def create_app(config_class=Config):
    """Create and configure the Flask application."""
    app = Flask(__name__)
    app.config.from_object(config_class)

    db.init_app(app)
    migrate.init_app(app, db)
    jwt.init_app(app)

    @jwt.token_in_blocklist_loader
    def is_token_revoked(jwt_header, jwt_payload):
        from .models import TokenBlocklist

        return (
            db.session.get(TokenBlocklist, jwt_payload["jti"])
            is not None
        )

    cors.init_app(
        app,
        resources={
            r"/api/*": {
                "origins": app.config["FRONTEND_ORIGIN"]
            }
        },
    )

    app.register_blueprint(admin_bp, url_prefix="/api")
    app.register_blueprint(health_bp, url_prefix="/api")
    app.register_blueprint(auth_bp, url_prefix="/api")
    app.register_blueprint(trip_preferences_bp, url_prefix="/api")
    app.register_blueprint(destinations_bp, url_prefix="/api")
    app.register_blueprint(accommodations_bp, url_prefix="/api")
    app.register_blueprint(itineraries_bp, url_prefix="/api")
    app.register_blueprint(recommendations_bp, url_prefix="/api")

    return app
