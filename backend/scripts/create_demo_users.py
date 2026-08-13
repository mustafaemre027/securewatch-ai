import os
import sys

# Allow importing from app
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy.orm import Session
from app.db.session import SessionLocal
from app.schemas.user import UserCreate
from app.models.user import UserRole
from app.services.user_service import create_user, get_user_by_username

def main():
    admin_user = os.environ.get("DEMO_ADMIN_USERNAME")
    admin_pass = os.environ.get("DEMO_ADMIN_PASSWORD")
    analyst_user = os.environ.get("DEMO_ANALYST_USERNAME")
    analyst_pass = os.environ.get("DEMO_ANALYST_PASSWORD")

    if not all([admin_user, admin_pass, analyst_user, analyst_pass]):
        print("Error: Missing required environment variables.", file=sys.stderr)
        sys.exit(1)

    db: Session = SessionLocal()
    try:
        # Create Admin
        existing_admin = get_user_by_username(db, admin_user)
        if existing_admin:
            print(f"User {admin_user} already exists with role {existing_admin.role.value}")
        else:
            create_user(db, UserCreate(
                username=admin_user,
                email=f"{admin_user}@demo.com",
                password=admin_pass,
                role=UserRole.ADMIN
            ))
            db.commit()
            print(f"User {admin_user} created with role ADMIN")

        # Create Analyst
        existing_analyst = get_user_by_username(db, analyst_user)
        if existing_analyst:
            print(f"User {analyst_user} already exists with role {existing_analyst.role.value}")
        else:
            create_user(db, UserCreate(
                username=analyst_user,
                email=f"{analyst_user}@demo.com",
                password=analyst_pass,
                role=UserRole.ANALYST
            ))
            db.commit()
            print(f"User {analyst_user} created with role ANALYST")

    except Exception:
        db.rollback()
        print("Database error occurred during user creation", file=sys.stderr)
        sys.exit(1)
    finally:
        db.close()


if __name__ == "__main__":
    main()
