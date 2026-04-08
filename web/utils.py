from datetime import datetime
from config import Config
from db import geofences, settings

def now():
    """Returns the current UTC datetime."""
    return datetime.utcnow()

def today():
    """Returns the current UTC date string in YYYY-MM-DD format."""
    return datetime.utcnow().strftime("%Y-%m-%d")

def parse_time(t_str):
    return datetime.strptime(t_str, "%H:%M").time()

def get_work_hours():
    """Fetches work hours from DB, falls back to Config."""
    s = settings.find_one({"type": "work_hours"})
    if s:
        return s["start"], s["end"]
    return Config.DEFAULT_WORK_START, Config.DEFAULT_WORK_END

def get_alert_interval():
    """Fetches alert interval in minutes from DB, defaults to 5."""
    s = settings.find_one({"type": "alert_interval"})
    if s and "minutes" in s:
        return int(s["minutes"])
    return 5

def within_work_hours(start_str=None, end_str=None):
    """Checks if current time is within work hours defined in DB or Config."""
    t = datetime.now().time()
    if not start_str or not end_str:
        start_str, end_str = get_work_hours()
    
    start_t = parse_time(start_str)
    end_t = parse_time(end_str)
    
    if start_t <= end_t:
        return start_t <= t <= end_t
    else:
        # Overnight shift (e.g. 20:00 to 04:00)
        return t >= start_t or t <= end_t

def point_in_polygon(lat, lng, poly):
    """
    Checks if a point (lat, lng) is inside a polygon.
    poly is a list of (lat, lng) tuples.
    """
    x, y = lng, lat
    inside = False
    for i in range(len(poly)):
        y1, x1 = poly[i]
        y2, x2 = poly[(i + 1) % len(poly)]
        if ((x1 > x) != (x2 > x)) and \
           (y < (y2 - y1) * (x - x1) / (x2 - x1 + 1e-9) + y1):
            inside = not inside
    return inside
