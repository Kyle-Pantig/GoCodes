"""
Utility functions for calculating report schedule times
"""
from datetime import datetime, timedelta, timezone
from typing import Optional
import os

# Get timezone offset from environment variable (default to UTC+8 for Philippines)
# Set REPORT_TIMEZONE_OFFSET to the number of hours offset from UTC (e.g., 8 for UTC+8, -5 for UTC-5)
TIMEZONE_OFFSET_HOURS = int(os.getenv("REPORT_TIMEZONE_OFFSET", "8"))
LOCAL_TIMEZONE = timezone(timedelta(hours=TIMEZONE_OFFSET_HOURS))

def calculate_next_run_at(
    frequency: str,
    frequency_day: Optional[int] = None,
    frequency_month: Optional[int] = None,
    scheduled_time: str = '02:00'
) -> datetime:
    """
    Calculate the next run time for a scheduled report based on frequency and schedule.
    The scheduled_time is interpreted in the configured local timezone (REPORT_TIMEZONE_OFFSET).
    Returns a UTC datetime for storage.
    """
    # Get current time in the configured local timezone
    now_utc = datetime.now(timezone.utc)
    now_local = now_utc.astimezone(LOCAL_TIMEZONE)
    
    hours, minutes = map(int, scheduled_time.split(':'))
    
    # Create next_run in local timezone
    next_run = now_local.replace(hour=hours, minute=minutes, second=0, microsecond=0)
    
    if frequency == 'daily':
        # If time has passed today, schedule for tomorrow
        if next_run <= now_local:
            next_run = next_run + timedelta(days=1)
    
    elif frequency == 'weekly':
        # frequency_day: 0 = Sunday, 1 = Monday, ..., 6 = Saturday
        target_day = frequency_day if frequency_day is not None else now_local.weekday()
        current_day = now_local.weekday()
        days_until_target = (target_day - current_day + 7) % 7
        
        # If it's the target day but time has passed, schedule for next week
        if days_until_target == 0 and next_run <= now_local:
            days_until_target = 7
        
        next_run = next_run + timedelta(days=days_until_target)
    
    elif frequency == 'monthly':
        # frequency_day: 1-31 (day of month)
        target_day_of_month = frequency_day if frequency_day is not None else now_local.day
        current_day_of_month = now_local.day
        
        # Set the day first
        try:
            next_run = next_run.replace(day=target_day_of_month)
        except ValueError:
            # If day doesn't exist in current month (e.g., Feb 30), use last day of month
            # Move to next month and use last valid day
            if next_run.month == 12:
                next_run = next_run.replace(year=next_run.year + 1, month=1, day=1)
            else:
                next_run = next_run.replace(month=next_run.month + 1, day=1)
            # Get last day of that month
            from calendar import monthrange
            last_day = monthrange(next_run.year, next_run.month)[1]
            next_run = next_run.replace(day=min(target_day_of_month, last_day))
        
        if target_day_of_month < current_day_of_month:
            # Target day has passed this month, schedule for next month
            if next_run.month == 12:
                next_run = next_run.replace(year=next_run.year + 1, month=1)
            else:
                next_run = next_run.replace(month=next_run.month + 1)
            # Ensure day is valid in new month
            from calendar import monthrange
            last_day = monthrange(next_run.year, next_run.month)[1]
            next_run = next_run.replace(day=min(target_day_of_month, last_day))
        elif target_day_of_month == current_day_of_month:
            # Same day - check if time has passed
            if next_run <= now_local:
                if next_run.month == 12:
                    next_run = next_run.replace(year=next_run.year + 1, month=1)
                else:
                    next_run = next_run.replace(month=next_run.month + 1)
                # Ensure day is valid in new month
                from calendar import monthrange
                last_day = monthrange(next_run.year, next_run.month)[1]
                next_run = next_run.replace(day=min(target_day_of_month, last_day))
    
    elif frequency == 'yearly':
        # frequency_month: 1-12 (January-December)
        # frequency_day: 1-31 (day of month)
        target_month = frequency_month if frequency_month is not None else now_local.month
        target_day_of_year = frequency_day if frequency_day is not None else now_local.day
        current_month = now_local.month
        current_day_of_year = now_local.day
        
        # Set month and day
        try:
            next_run = next_run.replace(month=target_month, day=target_day_of_year)
        except ValueError:
            # If day doesn't exist in target month, use last day of that month
            from calendar import monthrange
            last_day = monthrange(next_run.year, target_month)[1]
            next_run = next_run.replace(month=target_month, day=min(target_day_of_year, last_day))
        
        if (target_month < current_month or 
            (target_month == current_month and target_day_of_year < current_day_of_year) or 
            (target_month == current_month and target_day_of_year == current_day_of_year and next_run <= now_local)):
            # Target date has passed this year, schedule for next year
            next_run = next_run.replace(year=next_run.year + 1)
            # Ensure day is valid in target month of next year
            from calendar import monthrange
            last_day = monthrange(next_run.year, target_month)[1]
            next_run = next_run.replace(day=min(target_day_of_year, last_day))
    
    else:
        # Default to daily if frequency is not recognized
        if next_run <= now_local:
            next_run = next_run + timedelta(days=1)
    
    # Convert back to naive datetime (strip timezone info) for database storage
    # The database stores this as-is, and the frontend displays it in local time
    return next_run.replace(tzinfo=None)

