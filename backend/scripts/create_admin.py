#!/usr/bin/env python3
"""
Create or update the admin user.

Usage:
    python scripts/create_admin.py

Reads DATABASE_URL from the environment (or .env file).
Prompts interactively for email, full name, and password.
If a user with that email already exists, updates their password and
promotes them to admin.
"""
import asyncio
import getpass
import sys
from pathlib import Path

# Ensure the backend package root is on sys.path when run directly
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from dotenv import load_dotenv
load_dotenv(Path(__file__).resolve().parent.parent / ".env")

from sqlalchemy import select
from database import AsyncSessionLocal
from models.user import User, UserRole
from services.auth import hash_password


async def create_admin() -> None:
    print("=== weCapture4U — Create Admin User ===\n")

    email = input("Email: ").strip().lower()
    if not email or "@" not in email:
        print("Error: invalid email.")
        sys.exit(1)

    full_name = input("Full name: ").strip()
    if not full_name:
        print("Error: full name is required.")
        sys.exit(1)

    password = getpass.getpass("Password: ")
    if len(password) < 8:
        print("Error: password must be at least 8 characters.")
        sys.exit(1)

    confirm = getpass.getpass("Confirm password: ")
    if password != confirm:
        print("Error: passwords do not match.")
        sys.exit(1)

    hashed = hash_password(password)

    async with AsyncSessionLocal() as db:
        result = await db.execute(select(User).where(User.email == email))
        existing = result.scalar_one_or_none()

        if existing:
            existing.hashed_password = hashed
            existing.full_name = full_name
            existing.role = UserRole.admin
            existing.is_active = True
            await db.commit()
            print(f"\n✓ Updated existing user '{email}' — role set to admin.")
        else:
            user = User(
                email=email,
                full_name=full_name,
                hashed_password=hashed,
                role=UserRole.admin,
                is_active=True,
            )
            db.add(user)
            await db.commit()
            print(f"\n✓ Admin user '{email}' created successfully.")


if __name__ == "__main__":
    asyncio.run(create_admin())
