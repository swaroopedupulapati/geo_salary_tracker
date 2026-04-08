from flask import Flask, render_template, request, redirect, session, jsonify, Response
# werkzeug.security moved to auth_service
# datetime moved to utils/services
import os
import base64
import re
import cv2
import numpy as np
from deepface import DeepFace
from bson.binary import Binary
from config import Config
from db import users, geofences, attendance, locations, settings
from utils import now, today, parse_time, within_work_hours, point_in_polygon, get_work_hours, get_alert_interval
from services import auth_service
from werkzeug.security import check_password_hash
from seed import seed_db

import json
import json

# Auto-Seed on Startup
seed_db()

app = Flask(__name__)
app.secret_key = Config.SECRET_KEY

@app.route('/sw.js')
def sw():
    response = app.send_static_file('sw.js')
    response.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate'
    response.headers['Pragma'] = 'no-cache'
    response.headers['Expires'] = '0'
    return response

# Global Error Handler
@app.errorhandler(Exception)
def handle_exception(e):
    # Pass through HTTP errors
    if hasattr(e, 'code'):
        return jsonify({"error": str(e)}), e.code
    
    # Generic error
    return jsonify({"error": "Internal Server Error", "details": str(e)}), 500

# Open Camera (used for face register/login and streaming)
# Camera removal: Client-side used now
# camera = cv2.VideoCapture(0)

# ================= LIVE STATE =================
# LIVE_LOCATIONS moved to DB (locations collection)

# ================= HELPERS =================
# ================= HELPERS =================
# Time helpers moved to utils.py

def validate_json(required_fields):
    def decorator(f):
        def wrapper(*args, **kwargs):
            try:
                data = request.get_json(force=True)
                if not data:
                     return jsonify({"error": "No JSON data provided"}), 400
                missing = [field for field in required_fields if field not in data]
                if missing:
                    return jsonify({"error": f"Missing fields: {', '.join(missing)}"}), 400
            except Exception:
                return jsonify({"error": "Invalid JSON"}), 400
            return f(*args, **kwargs)
        wrapper.__name__ = f.__name__
        return wrapper
    return decorator

def login_required(role=None):
    def wrap(fn):
        def inner(*a, **kw):
            if "employee_id" not in session:
                if request.path.startswith("/api/"):
                    return jsonify({"error": "Unauthorized"}), 401
                return redirect("/login")
            
            if role:
                if role == "admin" and session["role"] != "admin":
                    if request.path.startswith("/api/"):
                        return jsonify({"error": "Admin access only"}), 403
                    return "Unauthorized: Admin Access Only", 403
                
                if role == "manager" and session["role"] not in ["manager", "admin"]:
                    if request.path.startswith("/api/"):
                        return jsonify({"error": "Manager access only"}), 403
                    return "Unauthorized", 403
                
                if role == "employee" and session["role"] not in ["employee", "manager", "admin"]:
                    pass
            
            return fn(*a, **kw)
        inner.__name__ = fn.__name__
        return inner
    return wrap

# ================= GEO =================
# ================= GEO =================
# point_in_polygon moved to utils.py

def get_geofences(employee_id=None):
    # 1. Check User Specific Fences
    if employee_id:
        u = users.find_one({"employee_id": employee_id})
        if u and "geofences" in u and u["geofences"]:
             return u["geofences"] # Array of polygons

    # 2. Check Global Active Fences
    g = geofences.find_one({"is_active": True})
    if g and "polygons" in g:
        return g["polygons"]
    elif g and "polygon" in g:
        return [g["polygon"]] # fallback for old schema
    return [Config.DEFAULT_GEOFENCE]
# ================= WORK POLICY =================
# ================= WORK POLICY =================
# within_work_hours moved to utils.py

# ================= ROUTES =================
@app.route("/")
def home():
    if "role" not in session:
        return redirect("/login")
    return redirect(f"/{session['role']}")

# -------- AUTH --------
@app.route("/register")
def register():
    return redirect("/login")

@app.route("/login", methods=["GET","POST"])
def login():
    if request.method == "POST":
        result = auth_service.authenticate_user(request.form["identifier"], request.form["password"])
        if isinstance(result, dict) and "error" in result:
             return render_template("login.html", error=result["error"])
        
        if result:
            user = result
            session["employee_id"] = user["employee_id"]
            session["name"] = user["name"]
            session["role"] = user["role"]
            return redirect("/")
        return render_template("login.html", error="Invalid login")
    return render_template("login.html")

@app.route("/logout")
def logout():
    locations.delete_one({"employee_id": session.get("employee_id")})
    session.clear()
    return redirect("/login")


# -------- AUTH APIs --------
@app.route("/api/login", methods=["POST"])
@validate_json(["identifier", "password"])
def api_login():
    data = request.get_json(force=True)
    user = auth_service.authenticate_user(data.get("identifier"), data.get("password"))
    
    if isinstance(user, dict) and "error" in user:
        return jsonify(user), 401

    if user:
        session["employee_id"] = user["employee_id"]
        session["name"] = user["name"]
        session["role"] = user["role"]
        return jsonify({
            "message": "Login successful",
            "user": {
                "employee_id": user["employee_id"],
                "name": user["name"],
                "role": user["role"],
                "email": user["email"]
            }
        })
    
    return jsonify({"error": "Invalid credentials"}), 401

@app.route("/api/login_face", methods=["POST"])
@validate_json(["username", "image"])
def api_login_face():
    data = request.get_json(force=True)
    username = data.get("username")
    image_data = data.get("image")
    
    user = users.find_one({"employee_id": username})
    if not user or "face_data" not in user:
        return jsonify({"error": "User not found or Face not registered!"}), 400

    try:
        header, encoded = image_data.split(",", 1)
        binary_data = base64.b64decode(encoded)
        np_arr = np.frombuffer(binary_data, np.uint8)
        current_frame = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)

        db_image_bytes = user["face_data"]
        nparr_db = np.frombuffer(db_image_bytes, np.uint8)
        db_img = cv2.imdecode(nparr_db, cv2.IMREAD_COLOR)
        
        result = DeepFace.verify(
            img1_path=current_frame,
            img2_path=db_img,
            enforce_detection=False
        )

        if result.get("verified"):
            session["employee_id"] = user["employee_id"]
            session["name"] = user["name"]
            session["role"] = user["role"]
            return jsonify({
                "message": "Login successful",
                "user": {
                    "employee_id": user["employee_id"],
                    "name": user["name"],
                    "role": user["role"],
                    "email": user["email"]
                }
            })
        else:
            return jsonify({"error": "Face Not Matched"}), 400

    except Exception as e:
        return jsonify({"error": str(e)}), 400

@app.route("/api/logout", methods=["POST"])
def api_logout():
    locations.delete_one({"employee_id": session.get("employee_id")})
    session.clear()
    return jsonify({"message": "Logged out successfully"})

@app.route("/api/register", methods=["POST"])
@validate_json(["employee_id", "name", "email", "password", "monthly_salary"])
def api_register():
    data = request.get_json(force=True)
    success, result = auth_service.register_user(data)
    
    if success:
        return jsonify({"message": result}), 201
    return jsonify({"error": result}), 400

@app.route("/api/me", methods=["GET"])
def api_me():
    if "employee_id" not in session:
        return jsonify({"error": "Not logged in"}), 401
    
    user = users.find_one({"employee_id": session["employee_id"]})
    if not user:
        return jsonify({"error": "User not found"}), 404
        
    return jsonify({
        "employee_id": user["employee_id"],
        "name": user["name"],
        "email": user["email"],
        "role": user["role"],
        "monthly_salary": user.get("monthly_salary"),
        "hourly_rate": user.get("hourly_rate"),
        "worked_seconds": user.get("worked_seconds", 0)
    })

@app.route("/api/geofence", methods=["GET"])
def api_get_geofence():
    fences = get_geofences()
    # Convert tuples to list of objects
    fences_list = [[{"lat": p[0], "lng": p[1]} for p in fence] for fence in fences]
    return jsonify({
        "geofences": fences_list,
        "work_start": Config.DEFAULT_WORK_START,
        "work_end": Config.DEFAULT_WORK_END
    })

@app.route("/api/attendance", methods=["GET"])
def api_attendance():
    if "employee_id" not in session:
         return jsonify({"error": "Not logged in"}), 401
         
    # Optional: filter by month/date
    # For now, return recent 30 logs
    logs_cursor = attendance.find({"employee_id": session["employee_id"]}).sort("date", -1).limit(30)
    
    logs = []
    for log in logs_cursor:
        logs.append({
            "date": log["date"],
            "in_time": log["in_time"].isoformat() if log.get("in_time") else None,
            "out_time": log["out_time"].isoformat() if log.get("out_time") else None,
            "worked_seconds": log.get("worked_seconds", 0),
            "status": log.get("status")
        })
        
    return jsonify({"attendance": logs})

# -------- EMPLOYEE --------
@app.route("/employee")
@login_required("employee")
def employee():
    fences = get_geofences(session["employee_id"])
    alert_interval = get_alert_interval()
    return render_template("employee.html", emp=session["employee_id"], geofences=fences, alert_interval=alert_interval)

@app.route("/verify-presence")
@login_required("employee")
def verify_presence():
    """Standalone page to verify presence without loading the dashboard."""
    return render_template("verify_presence.html")

@app.route("/api/verify_presence", methods=["POST"])
@login_required("employee")
def api_verify_presence():
    data = request.form
    password = data.get("password")
    image_data = data.get("image")
    
    user = users.find_one({"employee_id": session["employee_id"]})
    
    def on_verified():
        now_t = now()
        # Clear needs_verification flag and update the alert time
        locations.update_one(
            {"employee_id": session["employee_id"]}, 
            {"$set": {"last_alert_time": now_t, "needs_verification": False}}
        )
        # Also update last_increment_at so time tracking resumes accurately from now
        users.update_one(
            {"employee_id": session["employee_id"]},
            {"$set": {"last_increment_at": now_t}}
        )

    if password:
        if check_password_hash(user["password"], password):
            on_verified()
            return jsonify({"status": "verified"})
        else:
            return jsonify({"error": "Invalid password"}), 400
            
    elif image_data:
        if "face_data" not in user:
            return jsonify({"error": "Face not registered!"}), 400
            
        try:
            header, encoded = image_data.split(",", 1)
            binary_data = base64.b64decode(encoded)
            np_arr = np.frombuffer(binary_data, np.uint8)
            current_frame = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)

            db_image_bytes = user["face_data"]
            nparr_db = np.frombuffer(db_image_bytes, np.uint8)
            db_img = cv2.imdecode(nparr_db, cv2.IMREAD_COLOR)
            
            result = DeepFace.verify(
                img1_path=current_frame,
                img2_path=db_img,
                enforce_detection=False
            )

            if result.get("verified"):
                on_verified()
                return jsonify({"status": "verified"})
            else:
                return jsonify({"error": "Face Not Matched!"}), 400
        except Exception as e:
            return jsonify({"error": str(e)}), 400
            
    return jsonify({"error": "No data provided"}), 400

@app.route("/api/heartbeat", methods=["POST"])
@login_required("employee")
@validate_json(["lat", "lng"])
def heartbeat():
    d = request.get_json(force=True)
    lat, lng = float(d["lat"]), float(d["lng"])

    user = users.find_one({"employee_id": session["employee_id"]})
    shift_start = user.get("shift_start") if user else None
    shift_end = user.get("shift_end") if user else None

    fences = get_geofences(session["employee_id"])
    inside_fence = any(point_in_polygon(lat, lng, fence) for fence in fences)
    in_hours = within_work_hours(shift_start, shift_end)
    
    # Check if this user needs verification
    loc = locations.find_one({"employee_id": session["employee_id"]})
    needs_verification = loc.get("needs_verification", False) if loc else False

    status = "OUTSIDE"
    display_status = "OUTSIDE"

    if inside_fence:
        if in_hours:
            status = "INSIDE"
            display_status = "INSIDE"
        else:
            status = "OUTSIDE" # Still technically "Away" for attendance purposes
            display_status = "INSIDE (After Hours)"

    now_t = now()
    date = today()

    # If verification is pending, pause tracking and return a special status
    if needs_verification:
        display_status = "NEEDS_VERIFICATION"
        # We still update their coordinates in the DB but we skip time accrual
    else:
        # ---- DAILY LOG ----
        log = attendance.find_one({
            "employee_id": session["employee_id"],
            "date": date
        })

        if status == "INSIDE":
            if not log:
                # Check for Late Arrival
                eff_start = shift_start or Config.DEFAULT_WORK_START
                try:
                    from datetime import datetime, timedelta
                    eff_start_time = datetime.strptime(eff_start, "%H:%M").time()
                    # Combine today's date with eff_start_time to add grace minutes properly if doing datetime math
                    # Or simplify: just compare minutes since midnight
                    now_mins = now_t.hour * 60 + now_t.minute
                    start_mins = eff_start_time.hour * 60 + eff_start_time.minute
                    is_late = now_mins > (start_mins + Config.DEFAULT_GRACE_MINUTES)
                except:
                    is_late = False

                attendance_status = "LATE" if is_late else "PRESENT"

                attendance.insert_one({
                    "employee_id": session["employee_id"],
                    "date": date,
                    "in_time": now_t,
                    "out_time": now_t,
                    "worked_seconds": 0,
                    "status": attendance_status
                })
            else:
                attendance.update_one(
                    {"_id": log["_id"]},
                    {"$set": {"out_time": now_t}}
                )

            last = user.get("last_increment_at")
            if not last or (now_t - last).total_seconds() >= Config.HEARTBEAT_SECONDS:
                users.update_one(
                    {"employee_id": session["employee_id"]},
                    {"$inc": {"worked_seconds": Config.HEARTBEAT_SECONDS},
                     "$set": {"last_increment_at": now_t}}
                )
                attendance.update_one(
                    {"employee_id": session["employee_id"], "date": date},
                    {"$inc": {"worked_seconds": Config.HEARTBEAT_SECONDS}}
                )

    # Regardless of needs_verification, we still update their last known real location
    locations.update_one(
        {"employee_id": session["employee_id"]},
        {"$set": {
            "employee_id": session["employee_id"],
            "name": session["name"],
            "lat": lat,
            "lng": lng,
            "status": display_status,
            "last_updated": now_t
        }, "$setOnInsert": {"last_alert_time": now_t}},
        upsert=True
    )

    return jsonify({"status": display_status})

@app.route("/api/vapid_public_key", methods=["GET"])
@login_required("employee")
def get_vapid_key():
    return jsonify({"publicKey": Config.VAPID_PUBLIC_KEY})

@app.route("/api/trigger_verification", methods=["POST"])
@login_required("employee")
def trigger_verification():
    """Frontend calls this when its local timer expires, marking the employee as needing verification."""
    locations.update_one(
        {"employee_id": session["employee_id"]},
        {"$set": {"needs_verification": True}}
    )
    return jsonify({"status": "verification_triggered"})

@app.route("/api/stop_tracking", methods=["POST"])
@login_required("employee")
def stop_tracking():
    locations.delete_one({"employee_id": session["employee_id"]})
    
    # Check for early departure
    user = users.find_one({"employee_id": session["employee_id"]})
    shift_end = user.get("shift_end") if user else Config.DEFAULT_WORK_END
    
    now_t = now()
    date = today()
    log = attendance.find_one({
        "employee_id": session["employee_id"],
        "date": date
    })
    
    if log:
        try:
            from datetime import datetime
            eff_end_time = datetime.strptime(shift_end, "%H:%M").time()
            now_mins = now_t.hour * 60 + now_t.minute
            end_mins = eff_end_time.hour * 60 + eff_end_time.minute
            if now_mins < end_mins:
                # Early Leave
                new_status = log.get("status", "PRESENT")
                if "EARLY_LEAVE" not in new_status:
                    new_status += " (EARLY_LEAVE)"
                attendance.update_one(
                    {"_id": log["_id"]},
                    {"$set": {"status": new_status, "out_time": now_t}}
                )
        except Exception:
            pass

    return jsonify({"status": "STOPPED"})

from flask import send_file
from services.payroll_service import calculate_payroll, generate_payslip_pdf
import os

@app.route("/api/employee/payslip", methods=["GET"])
@login_required("employee")
def download_payslip():
    month_str = request.args.get("month") # format: YYYY-MM
    if not month_str:
        return jsonify({"error": "Month required. format: YYYY-MM"}), 400
    try:
        year, month = map(int, month_str.split("-"))
    except:
        return jsonify({"error": "Invalid format"}), 400
        
    data = calculate_payroll(session["employee_id"], month, year)
    if not data:
        return jsonify({"error": "No data found"}), 404
        
    pdf_path = generate_payslip_pdf(data)
    if os.path.exists(pdf_path):
        return send_file(pdf_path, as_attachment=True)
    return jsonify({"error": "Failed to generate PDF"}), 500

@app.route("/api/admin/payslip/<employee_id>", methods=["GET"])
@login_required("admin")
def download_admin_payslip(employee_id):
    month_str = request.args.get("month")
    if not month_str:
        return jsonify({"error": "Month required. format: YYYY-MM"}), 400
    try:
        year, month = map(int, month_str.split("-"))
    except:
        return jsonify({"error": "Invalid format"}), 400
        
    data = calculate_payroll(employee_id, month, year)
    if not data:
        return jsonify({"error": "No data found"}), 404
        
    pdf_path = generate_payslip_pdf(data)
    if os.path.exists(pdf_path):
        return send_file(pdf_path, as_attachment=True)
    return jsonify({"error": "Failed to generate PDF"}), 500

import csv
from io import StringIO
from flask import make_response

@app.route("/api/admin/export/attendance")
@login_required("admin")
def export_attendance():
    month_str = request.args.get("month") # YYYY-MM
    if not month_str:
        # Default to current month
        month_str = today()[:7]
    
    start_date = f"{month_str}-01"
    end_date = f"{month_str}-31"
    
    logs = list(attendance.find({
        "date": {"$gte": start_date, "$lte": end_date}
    }))
    
    si = StringIO()
    cw = csv.writer(si)
    cw.writerow(['Date', 'Employee ID', 'Name', 'In Time', 'Out Time', 'Status', 'Worked Hours'])
    
    # Pre-fetch user map for names
    user_map = {u["employee_id"]: u["name"] for u in users.find()}
    
    for log in logs:
        emp_id = log.get("employee_id", "")
        name = user_map.get(emp_id, "Unknown")
        worked_hours = round(log.get("worked_seconds", 0) / 3600.0, 2)
        in_time = log.get("in_time").strftime("%H:%M:%S") if log.get("in_time") else ""
        out_time = log.get("out_time").strftime("%H:%M:%S") if log.get("out_time") else ""
        
        cw.writerow([
            log.get("date", ""),
            emp_id,
            name,
            in_time,
            out_time,
            log.get("status", ""),
            worked_hours
        ])
        
    output = make_response(si.getvalue())
    output.headers["Content-Disposition"] = f"attachment; filename=attendance_{month_str}.csv"
    output.headers["Content-type"] = "text/csv"
    return output

@app.route("/api/employee/stats")
@login_required("employee")
def employee_stats():
    u = users.find_one({"employee_id": session["employee_id"]})
    secs = u.get("worked_seconds", 0)
    return jsonify({
        "worked_minutes": secs // 60,
        "earned": round((secs / 3600) * u["hourly_rate"], 2)
    })

# -------- MANAGER --------
@app.route("/manager")
@login_required("manager")
def manager():
    fences = get_geofences()
    return render_template("manager.html", geofences=fences)



@app.route("/api/manager/register", methods=["POST"])
@login_required("manager")
def manager_register():
    data = request.get_json(force=True)
    # Manager can only create Employees, or maybe other Managers? 
    # Let's allow them to set role, default to employee
    
    # Enforce formatting
    if "employee_id" not in data or "password" not in data:
        return jsonify({"error": "Missing required fields"}), 400

    success, msg = auth_service.register_user(data)
    if success:
        return jsonify({"status": "created", "msg": msg})
    return jsonify({"error": msg}), 400

@app.route("/api/manager/live")
@login_required("manager")
def manager_live():
    live, seen = [], set()

    for e in locations.find():
        u = users.find_one({"employee_id": e["employee_id"]})
        if not u: continue # orphaned location entry
        
        seen.add(e["employee_id"])
        ws = u.get("worked_seconds", 0)
        live.append({
            "id": e["employee_id"],
            "name": e["name"],
            "lat": e["lat"],
            "lng": e["lng"],
            "status": e["status"],
            "worked_minutes": ws // 60,
            "earned": round((ws / 3600) * u["hourly_rate"], 2)
        })

    offline = []
    for u in users.find({"role": "employee"}):
        if u["employee_id"] not in seen:
            ws = u["worked_seconds"]
            offline.append({
                "id": u["employee_id"],
                "name": u["name"],
                "worked_minutes": ws // 60,
                "earned": round((ws / 3600) * u["hourly_rate"], 2)
            })

    return jsonify({"live": live, "offline": offline})


# -------- ADMIN --------
@app.route("/admin")
@login_required("admin")
def admin_dashboard():
    all_users = list(users.find({}, {"password": 0, "face_data": 0}))
    pending_managers = list(users.find({"role": "manager", "approved": False}, {"password": 0, "face_data": 0}))
    fences = get_geofences()
    return render_template("admin.html", users=all_users, pending=pending_managers, geofences=fences)

@app.route("/api/admin/approve/<emp_id>", methods=["POST"])
@login_required("admin")
def approve_user(emp_id):
    users.update_one({"employee_id": emp_id}, {"$set": {"approved": True}})
    return jsonify({"status": "approved"})

@app.route("/api/admin/users/<emp_id>", methods=["DELETE"])
@login_required("admin")
def delete_user(emp_id):
    users.delete_one({"employee_id": emp_id})
    # Also delete associated data if needed (attendance, etc)
    return jsonify({"status": "deleted"})

@app.route("/api/admin/geofence", methods=["POST"])
@login_required("admin")
def update_geofence():
    data = request.get_json(force=True)
    # Expected data: [[{"lat": ..., "lng": ...}, ...], [...]]
    new_fences = []
    try:
        if not isinstance(data, list):
            return jsonify({"error": "Expected a list of polygons"}), 400
            
        for poly in data:
            fence = []
            for p in poly:
                fence.append((float(p["lat"]), float(p["lng"])))
            new_fences.append(fence)
        
        geofences.update_one(
            {"is_active": True},
            {"$set": {"polygons": new_fences}},
            upsert=True
        )
        return jsonify({"status": "updated"})
    except Exception as e:
        return jsonify({"error": str(e)}), 400
@app.route("/api/admin/register", methods=["POST"])
@login_required("admin")
def admin_register():
    data = request.get_json(force=True)
    # Admin can create ANY role
    
    # Enforce formatting
    if "employee_id" not in data or "password" not in data:
        return jsonify({"error": "Missing required fields"}), 400

    success, msg = auth_service.register_user(data)
    if success:
        return jsonify({"status": "created", "msg": msg})
    return jsonify({"error": msg}), 400

@app.route("/api/admin/users/<emp_id>/geofence", methods=["GET", "POST"])
@login_required("admin")
def user_geofence(emp_id):
    if request.method == "POST":
        data = request.get_json(force=True)
        
        # Check for Reset/Delete signal
        if data is None or (isinstance(data, dict) and data.get("action") == "reset"):
            users.update_one(
                {"employee_id": emp_id},
                {"$unset": {"geofences": ""}}
            )
            return jsonify({"status": "reset_to_default"})

        # Expecting similar format to global fence: [[{"lat":..., "lng":...}], [...]]
        new_fences = []
        try:
            if isinstance(data, list):
                for poly in data:
                    fence = []
                    for p in poly:
                        fence.append((float(p["lat"]), float(p["lng"])))
                    new_fences.append(fence)
                
                users.update_one(
                    {"employee_id": emp_id},
                    {"$set": {"geofences": new_fences}}
                )
                return jsonify({"status": "updated"})
            else:
                return jsonify({"error": "Invalid data format"}), 400
        except Exception as e:
            return jsonify({"error": str(e)}), 400
            
    # GET
    u = users.find_one({"employee_id": emp_id})
    if u and "geofences" in u and u["geofences"]:
        fences_list = [[{"lat": p[0], "lng": p[1]} for p in fence] for fence in u["geofences"]]
        return jsonify({"geofences": fences_list, "type": "user"})
    else:
        return jsonify({"geofences": None, "type": "default"})

@app.route("/api/admin/settings", methods=["GET", "POST"])
@login_required("admin")
def admin_settings():
    if request.method == "POST":
        data = request.get_json(force=True)
        if "start" in data and "end" in data:
            try:
                 parse_time(data["start"])
                 parse_time(data["end"])
            except ValueError:
                 return jsonify({"error": "Invalid time format. Use HH:MM"}), 400
            
            settings.update_one(
                {"type": "work_hours"},
                {"$set": {"start": data["start"], "end": data["end"]}},
                upsert=True
            )
        
        if "alert_interval" in data:
            try:
                interval_minutes = int(data["alert_interval"])
                if interval_minutes < 1:
                    interval_minutes = 5
                settings.update_one(
                    {"type": "alert_interval"},
                    {"$set": {"minutes": interval_minutes}},
                    upsert=True
                )
            except ValueError:
                return jsonify({"error": "Alert interval must be an integer"}), 400
                
        return jsonify({"status": "updated"})
    
    start, end = get_work_hours()
    alert_interval = get_alert_interval()
    return jsonify({"start": start, "end": end, "alert_interval": alert_interval})

# ---------------- CAMERA STREAM ----------------
# ---------------- CAMERA STREAM ----------------
# Deprecated: Client-side camera is used now
@app.route('/face/video_feed')
def face_video_feed():
    return "Video feed deprecated. Use client-side camera.", 410


# ---------------- FACE HOME ----------------
@app.route('/face')
def face_index():
    try:
        return render_template('face_index.html')
    except Exception:
        return "Face Home"


# ---------------- FACE REGISTER ----------------
@app.route('/face/register', methods=['GET', 'POST'])
def face_register():
    prefill = request.args.get('username') or request.args.get('employee_id')
    if request.method == 'POST':
        username = request.form.get('username')
        image_data = request.form.get('image')

        if not username or not image_data:
            return "Username and Image required"

        try:
            # Decode Base64 Image
            header, encoded = image_data.split(",", 1)
            binary_data = base64.b64decode(encoded)
            
            # Create Binary object for MongoDB
            face_blob = Binary(binary_data)

            # Update user with face data
            result = users.update_one(
                {"employee_id": username},
                {"$set": {"face_data": face_blob}}
            )
            
            if result.matched_count == 0:
                return f"User {username} not found in DB. Please register user details first."

            return f"Face Registered Successfully for {username}"
        except Exception as e:
            return f"Error processing image: {e}"

    return render_template('face_register.html', prefill_username=prefill)


# ---------------- FACE LOGIN ----------------
@app.route('/face/login', methods=['GET', 'POST'])
def face_login():
    prefill = request.args.get('username') or request.args.get('employee_id')
    if request.method == 'POST':
        username = request.form.get('username')
        image_data = request.form.get('image')
        
        if not username or not image_data:
             return "Username and Image required"
        
        user = users.find_one({"employee_id": username})
        if not user or "face_data" not in user:
            return "User not found or Face not registered!"

        try:
             # Decode Base64 Image from Request
            header, encoded = image_data.split(",", 1)
            binary_data = base64.b64decode(encoded)
            np_arr = np.frombuffer(binary_data, np.uint8)
            current_frame = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)

            # 1. Get registered face from DB
            db_image_bytes = user["face_data"]
            nparr_db = np.frombuffer(db_image_bytes, np.uint8)
            db_img = cv2.imdecode(nparr_db, cv2.IMREAD_COLOR)
            
            # 2. Verify Face
            result = DeepFace.verify(
                img1_path=current_frame,
                img2_path=db_img,
                enforce_detection=False
            )

            if result.get("verified"):
                session["employee_id"] = user["employee_id"]
                session["name"] = user["name"]
                session["role"] = user["role"]
                return redirect('/')
            else:
                return "❌ Face Not Matched"

        except Exception as e:
            return f"Error: {e}"

    return render_template('face_login.html', prefill_username=prefill)



if __name__ == "__main__":
    try:
        from pyngrok import ngrok, conf
        conf.get_default().auth_token = os.environ.get("NGROK_AUTH_TOKEN")
        domain = os.environ.get("NGROK_DOMAIN")
        print("Starting ngrok tunnel...")
        # Only unpack domain config if it exists
        if domain:
            public_url = ngrok.connect(5000, domain=domain).public_url
        else:
            public_url = ngrok.connect(5000).public_url
        print(f" * ngrok tunnel \"{public_url}\" -> \"http://127.0.0.1:5000\"")
    except Exception as e:
        print(f" * Failed to start ngrok: {e}")

    app.run(host="0.0.0.0", port=5000, debug=True, use_reloader=False)
