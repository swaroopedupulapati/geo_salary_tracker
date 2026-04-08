import os
from dotenv import load_dotenv

load_dotenv()

class Config:
    SECRET_KEY = os.environ.get("SECRET_KEY") or "dev_secret_key"
    MONGO_URI = os.environ.get("MONGO_URI") or "mongodb://user_44e3n5mmb:p44e3n5mmb@bytexldb.com:5050/db_44e3n5mmb"
    DB_NAME = os.environ.get("DB_NAME") or "db_44e3n5mmb"
    
    # Business Logic Config
    DEFAULT_WORK_START = "09:00"
    DEFAULT_WORK_END = "18:00"
    DEFAULT_GRACE_MINUTES = 15
    
    # Web Push VAPID Config
    VAPID_PUBLIC_KEY = os.getenv("VAPID_PUBLIC_KEY")
    VAPID_PRIVATE_KEY = os.getenv("VAPID_PRIVATE_KEY")
    VAPID_SUBJECT = os.getenv("VAPID_SUBJECT", "mailto:admin@example.com")
    WORK_DAYS_PER_MONTH = 26
    HEARTBEAT_SECONDS = 60
    DEFAULT_GEOFENCE = [
        (15.479276, 80.019937),
        (15.480740, 80.020839),
        (15.479827, 80.022975),
        (15.478160, 80.022092)
    ]
