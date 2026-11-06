"""Create the initial Safari Planner administrator account."""

from getpass import getpass

from sqlalchemy import func, select
from sqlalchemy.exc import SQLAlchemyError

from app import create_app
from app.extensions import db
from app.models import Role, User


def main():
    app = create_app()

    with app.app_context():
        admin_role = db.session.scalar(
            select(Role).where(Role.name == "admin")
        )

        if admin_role is None:
            print("The admin role does not exist. Check your database setup.")
            return

        full_name = input("Administrator full name: ").strip()
        email = input("Administrator email: ").strip().lower()

        if not full_name or len(full_name) > 120:
            print("Enter a valid full name (1–120 characters).")
            return

        if not email or len(email) > 255 or "@" not in email:
            print("Enter a valid email address.")
            return

        existing_user = db.session.scalar(
            select(User).where(func.lower(User.email) == email)
        )

        if existing_user:
            print("An account with this email already exists.")
            print("No account or role was changed.")
            return

        password = getpass("Administrator password (minimum 12 characters): ")
        confirmation = getpass("Confirm administrator password: ")

        if len(password) < 12:
            print("Password must contain at least 12 characters.")
            return

        if password != confirmation:
            print("Passwords do not match.")
            return

        try:
            admin = User(
                full_name=full_name,
                email=email,
                role_id=admin_role.id,
            )
            admin.set_password(password)

            db.session.add(admin)
            db.session.commit()

            print(f"Administrator account created for {email}.")

        except SQLAlchemyError:
            db.session.rollback()
            print("Unable to create the administrator account.")
            raise


if __name__ == "__main__":
    main()
