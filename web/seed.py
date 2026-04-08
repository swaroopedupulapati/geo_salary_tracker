from werkzeug.security import generate_password_hash
from db import users, settings, geofences
from config import Config

def seed_db():
    print("Seeding Database...")
    
    # 1. Seed Admin
    if not users.find_one({"role": "admin"}):
        print("Creating Default Admin...")
        users.insert_one({
            "employee_id": "admin",
            "name": "System Admin",
            "email": "admin@geo.com",
            "password": generate_password_hash("admin123"),
            "role": "admin",
            "monthly_salary": 0,
            "hourly_rate": 0,
            "worked_seconds": 0,
            "last_increment_at": None,
            "approved": True # Admins are auto-approved
        })
    else:
        print("Admin exists.")

    # 1.5 Seed Manager
    if not users.find_one({"role": "manager"}):
        print("Creating Default Manager...")
        users.insert_one({
            "employee_id": "manager",
            "name": "System Manager",
            "email": "manager@geo.com",
            # "password": generate_password_hash("manager123"),
            # Fixed salt for consistent testing if needed, or just let it generate random
            "password": generate_password_hash("manager123"),
            "role": "manager",
            "monthly_salary": 0,
            "hourly_rate": 0,
            "worked_seconds": 0,
            "last_increment_at": None,
            "approved": True # Managers need approval, but default one is auto-approved
        })
    else:
        print("Manager exists.")

    # 2. Seed Work Hours
    if not settings.find_one({"type": "work_hours"}):
        print("Creating Default Work Hours...")
        settings.insert_one({
            "type": "work_hours",
            "start": Config.DEFAULT_WORK_START, # "09:00"
            "end": Config.DEFAULT_WORK_END     # "16:00"
        })
    else:
        print("Work Hours exist.")

    # 3. Seed Geofence
    if not geofences.find_one({"is_active": True}):
        print("Creating Default Geofence...")
        geofences.insert_one({
            "name": "Default Office",
            "polygon": Config.DEFAULT_GEOFENCE,
            "is_active": True
        })
    else:
        print("Geofence exists.")
        
    print("Seeding Complete.")

if __name__ == "__main__":
    seed_db()
