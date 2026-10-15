"""Configuration for Safari Planner."""

import os
from pathlib import Path

from dotenv import load_dotenv

BACKEND_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BACKEND_DIR / ".env")


class Config:
    """Application configuration."""

    SECRET_KEY = os.getenv("SECRET_KEY", "development-only-change-me")
    JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", SECRET_KEY)

    SQLALCHEMY_DATABASE_URI = os.getenv(
        "DATABASE_URL",
        "postgresql+psycopg2://safari_planner_user:CHANGE_ME@localhost:5432/safari_planner",
    )
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    FRONTEND_ORIGIN = os.getenv(
        "FRONTEND_ORIGIN",
        "http://localhost:5173",
    )
