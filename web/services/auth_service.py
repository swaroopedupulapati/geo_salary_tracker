from werkzeug.security import generate_password_hash, check_password_hash
from bson.binary import Binary
from db import users
from datetime import datetime
from config import Config

def register_user(data):
    """
    Registers a new user.
    data: dict containing employee_id, name, email, password, role, monthly_salary
    Returns: (success_bool, message_or_error)
    """
    # Check if user exists
    if users.find_one({"$or": [{"employee_id": data["employee_id"]}, {"email": data["email"]}]}):
        return False, "User already exists"

    salary = float(data.get("monthly_salary", 0))
    
    # Calculate hourly rate
    user_shift_start = data.get("shift_start") or Config.DEFAULT_WORK_START
    user_shift_end = data.get("shift_end") or Config.DEFAULT_WORK_END

    work_start = datetime.strptime(user_shift_start, "%H:%M")
    work_end = datetime.strptime(user_shift_end, "%H:%M")
    
    # Handle overnight shift for daily hours calculation
    if work_end < work_start:
        daily_hours = (24 - (work_start.hour - work_end.hour) - (work_start.minute - work_end.minute)/60.0)
    else:
        daily_hours = (work_end - work_start).total_seconds() / 3600
        
    hourly_rate = round(salary / (Config.WORK_DAYS_PER_MONTH * max(daily_hours, 1)), 2)
    role = data.get("role", "employee")

    users.insert_one({
        "employee_id": data["employee_id"],
        "name": data["name"],
        "email": data["email"],
        "password": generate_password_hash(data["password"]),
        "role": role,
        "monthly_salary": salary,
        "hourly_rate": hourly_rate,
        "shift_start": user_shift_start,
        "shift_end": user_shift_end,
        "worked_seconds": 0,
        "last_increment_at": None,
        "approved": False if role == "manager" else True # Managers need approval
    })
    
    msg = "Registration successful. Please wait for Admin approval." if role == "manager" else "User registered successfully"
    
    # Handle Face Image
    if "face_image" in data and data["face_image"]:
        try:
            import base64
            import os
            
            # Create dataset directory if not exists
            if not os.path.exists("dataset"):
                os.makedirs("dataset")
                
            # Decode and save
            img_data = base64.b64decode(data["face_image"].split(',')[1])
            img_path = f"dataset/{data['employee_id']}.jpg"
            
            with open(img_path, "wb") as f:
                f.write(img_data)
                
            # Update user with face image path AND binary data for login
            users.update_one(
                {"employee_id": data["employee_id"]},
                {"$set": {
                    "face_image_path": img_path,
                    "face_data": Binary(img_data)
                }}
            )
            
            # Optional: Delete pickle to force re-training if using DeepFace find
            if os.path.exists("representations_vgg.pkl"):
                os.remove("representations_vgg.pkl")
                
        except Exception as e:
            print(f"Error saving face image: {e}")
            # Non-blocking error, user is still created
            msg += " (Warning: Face save failed)"

    return True, msg

def authenticate_user(identifier, password):
    """
    Authenticates a user by employee_id or email.
    Returns: user_dict or None
    """
    user = users.find_one({
        "$or": [
            {"employee_id": identifier},
            {"email": identifier}
        ]
    })

    if user and check_password_hash(user["password"], password):
        # Check approval
        if user.get("role") == "manager" and not user.get("approved", False):
             return {"error": "Account pending approval"}
        return user
    
    return None
