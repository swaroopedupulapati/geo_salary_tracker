from pymongo import MongoClient
from config import Config

def get_db():
    client = MongoClient(Config.MONGO_URI)
    return client[Config.DB_NAME]

# Global DB instance (can be used directly)
# Note: In a larger app, we might use Flask-PyMongo or init_app pattern,
# but for this simple structure, a module-level global is okay or
# better yet, a function we call. Here we'll expose a lazy client or just the function.

# Let's keep it simple and safe for imports:
client = MongoClient(Config.MONGO_URI)
db = client[Config.DB_NAME]

users = db["users"]
geofences = db["geofences"]
attendance = db["attendance_logs"]
locations = db["locations"]
settings = db["settings"]
