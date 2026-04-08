from werkzeug.security import generate_password_hash
from db import users

def create_admin():
    if users.find_one({"employee_id": "admin"}):
        print("Admin already exists.")
        # Update role just in case
        users.update_one({"employee_id": "admin"}, {"$set": {"role": "admin"}})
        print("Admin role ensured.")
        return

    users.insert_one({
        "employee_id": "admin",
        "name": "System Admin",
        "email": "admin@geo.com",
        "password": generate_password_hash("admin123"),
        "role": "admin",
        "monthly_salary": 0,
        "hourly_rate": 0,
        "worked_seconds": 0,
        "last_increment_at": None
    })
    print("Admin user created. User: admin, Pass: admin123")

if __name__ == "__main__":
    create_admin()
