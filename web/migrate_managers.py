from db import users

def migrate_managers():
    print("Migrating Legacy Managers...")
    result = users.update_many(
        {"role": "manager", "approved": {"$exists": False}}, 
        {"$set": {"approved": True}}
    )
    print(f"Updated {result.modified_count} managers to Approved status.")

if __name__ == "__main__":
    migrate_managers()
