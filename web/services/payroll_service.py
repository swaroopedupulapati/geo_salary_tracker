import os
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas
from datetime import datetime
from config import Config
from db import attendance, users

# Directory to save payslips temporarily
PAYSLIP_DIR = os.path.join(os.getcwd(), "payslips")
if not os.path.exists(PAYSLIP_DIR):
    os.makedirs(PAYSLIP_DIR)

def calculate_payroll(employee_id, month, year):
    """
    Calculates salary for a given month considering basic hours and overtime.
    Returns a dict with payroll details.
    """
    user = users.find_one({"employee_id": employee_id})
    if not user:
        return None

    # Find total worked seconds in the given month
    # We filter attendance logs that fall within the month
    start_date = f"{year}-{month:02d}-01"
    # Simple logic to get end of month (up to 31st)
    end_date = f"{year}-{month:02d}-31"
    
    logs = list(attendance.find({
        "employee_id": employee_id,
        "date": {"$gte": start_date, "$lte": end_date}
    }))

    total_worked_seconds = sum(log.get("worked_seconds", 0) for log in logs)
    total_worked_hours = total_worked_seconds / 3600.0
    
    hourly_rate = float(user.get("hourly_rate", 0))
    monthly_salary_base = float(user.get("monthly_salary", 0))
    
    # Calculate expected hours
    shift_start = user.get("shift_start", Config.DEFAULT_WORK_START)
    shift_end = user.get("shift_end", Config.DEFAULT_WORK_END)
    start_t = datetime.strptime(shift_start, "%H:%M")
    end_t = datetime.strptime(shift_end, "%H:%M")
    
    if end_t < start_t:
        daily_hours = (24 - (start_t.hour - end_t.hour) - (start_t.minute - end_t.minute)/60.0)
    else:
        daily_hours = (end_t - start_t).total_seconds() / 3600.0

    expected_monthly_hours = Config.WORK_DAYS_PER_MONTH * daily_hours
    
    # Very basic overtime logic: 1.5x pay for hours above expected
    regular_hours = min(total_worked_hours, expected_monthly_hours)
    overtime_hours = max(0, total_worked_hours - expected_monthly_hours)
    
    regular_pay = regular_hours * hourly_rate
    overtime_pay = overtime_hours * hourly_rate * 1.5
    
    total_pay = regular_pay + overtime_pay

    return {
        "employee_id": employee_id,
        "name": user.get("name"),
        "month": f"{month:02d}-{year}",
        "hourly_rate": round(hourly_rate, 2),
        "expected_hours": round(expected_monthly_hours, 2),
        "total_worked_hours": round(total_worked_hours, 2),
        "regular_hours": round(regular_hours, 2),
        "overtime_hours": round(overtime_hours, 2),
        "regular_pay": round(regular_pay, 2),
        "overtime_pay": round(overtime_pay, 2),
        "total_pay": round(total_pay, 2)
    }

def generate_payslip_pdf(payroll_data):
    """
    Generates a PDF payslip and returns the file path.
    """
    filename = f"payslip_{payroll_data['employee_id']}_{payroll_data['month']}.pdf"
    filepath = os.path.join(PAYSLIP_DIR, filename)
    
    c = canvas.Canvas(filepath, pagesize=letter)
    width, height = letter
    
    # Header
    c.setFont("Helvetica-Bold", 16)
    c.drawString(200, height - 50, "EMPLOYEE PAYSLIP")
    
    # Company details (Mock)
    c.setFont("Helvetica", 10)
    c.drawString(50, height - 80, "Swaro Workforce Management")
    c.drawString(50, height - 95, "Geo-Fenced AI Attendance")
    
    # Employee Details
    c.setFont("Helvetica-Bold", 12)
    c.drawString(50, height - 130, f"Employee Name: {payroll_data['name']}")
    c.drawString(50, height - 150, f"Employee ID: {payroll_data['employee_id']}")
    c.drawString(50, height - 170, f"Month: {payroll_data['month']}")
    
    # Payroll Details
    c.setFont("Helvetica-Bold", 12)
    c.drawString(50, height - 210, "Earnings Summary")
    
    c.setFont("Helvetica", 11)
    c.drawString(50, height - 240, f"Hourly Rate: INR {payroll_data['hourly_rate']}")
    c.drawString(50, height - 260, f"Expected Monthly Hours: {payroll_data['expected_hours']} hrs")
    c.drawString(50, height - 280, f"Actual Worked Hours: {payroll_data['total_worked_hours']} hrs")
    
    c.line(50, height - 295, width - 50, height - 295)
    
    c.drawString(50, height - 315, f"Regular Pay ({payroll_data['regular_hours']} hrs):")
    c.drawString(300, height - 315, f"INR {payroll_data['regular_pay']}")
    
    c.drawString(50, height - 335, f"Overtime Pay ({payroll_data['overtime_hours']} hrs):")
    c.drawString(300, height - 335, f"INR {payroll_data['overtime_pay']}")
    
    c.line(50, height - 350, width - 50, height - 350)
    
    c.setFont("Helvetica-Bold", 14)
    c.drawString(50, height - 380, "TOTAL NET PAY:")
    c.drawString(300, height - 380, f"INR {payroll_data['total_pay']}")
    
    # Footer
    c.setFont("Helvetica-Oblique", 10)
    c.drawString(50, 50, "This is a system generated payslip and does not require a signature.")
    
    c.save()
    return filepath
