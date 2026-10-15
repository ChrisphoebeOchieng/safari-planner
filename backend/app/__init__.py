"""Safari Planner Flask application factory."""

from flask import Flask

from .config import Config
from .extensions import cors, db, jwt, migrate
from . import models  # Register models for migrations.
from .routes.health import health_bp
from .routes.trip_preferences import trip_preferences_bp


def create_app(config_class=Config):
    """Create and configure the Flask application."""
    app = Flask(__name__)
    app.config.from_object(config_class)

    db.init_app(app)
    migrate.init_app(app, db)
    jwt.init_app(app)

    cors.init_app(
        app,
        resources={
            r"/api/*": {
                "origins": app.config["FRONTEND_ORIGIN"]
            }
        },
    )

    app.register_blueprint(health_bp, url_prefix="/api")
    app.register_blueprint(trip_preferences_bp, url_prefix="/api")

    return app
