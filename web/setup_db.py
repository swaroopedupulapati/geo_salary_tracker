from pymongo import MongoClient, GEOSPHERE
import time

def init_db():
    client = MongoClient("mongodb://localhost:27017")
    db = client["geo_platform2"]

    # 1. Users
    # Ensure unique employee_id
    db.users.create_index("employee_id", unique=True)
    print("✅ Users index created.")

    # 2. Geofences
    # Ensure 2dsphere index on 'geometry' field for geospatial queries
    db.geofences.create_index([("geometry", GEOSPHERE)])
    print("✅ Geofences 2dsphere index created.")

    # 3. Pings (TTL)
    # Create TTL index to expire documents after 24 hours (86400 seconds)
    db.pings.create_index("timestamp", expireAfterSeconds=86400)
    # Create 2dsphere index for potential geospatial queries on pings
    db.pings.create_index([("coordinates", GEOSPHERE)])
    print("✅ Pings TTL & Geospatial indexes created.")

    # 4. Attendance
    # Compound index for fast lookups
    db.attendance_logs.create_index([("employee_id", 1), ("date", 1)])
    print("✅ Attendance compound index created.")

if __name__ == "__main__":
    init_db()
