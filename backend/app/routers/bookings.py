from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime, timezone, timedelta

from app.db.database import SessionLocal
from app.db.models import Booking
from app.core.security import verify_session
from app.enums import Role, ResourceType, RoomType
from app.core.config import (
    MAX_DAYS_AHEAD,
    MIN_TIME,
    MAX_TIME,
    STEP_MINUTES,
    DEFAULT_DURATION_MINNUTES,
    RESOURCE_RULES,
)

router = APIRouter(prefix="/bookings")

# =====================
# Helpers
# =====================

def parse_time_to_minutes(t: str) -> int:
    h, m = map(int, t.split(":"))
    return h * 60 + m


def get_buffer_minutes(resource: ResourceType) -> int:
    rule = RESOURCE_RULES.get(resource)
    return rule["buffer_minutes"] if rule else 0


MIN_TIME_MINUTES = parse_time_to_minutes(MIN_TIME)
MAX_TIME_MINUTES = parse_time_to_minutes(MAX_TIME)

CET = timezone(timedelta(hours=1))  # fixed CET (no DST by design)

# =====================
# Routes
# =====================

@router.get("/")
def list_bookings():
    db: Session = SessionLocal()
    try:
        return db.query(Booking).all()
    finally:
        db.close()


@router.post("/")
def create_booking(
    data: dict,
    role: Role = Depends(verify_session),
):
    if role not in (Role.USER, Role.ADMIN):
        raise HTTPException(403, "Keine Berechtigung")

    try:
        room = RoomType[data["room"]]
        resource = ResourceType[data["resource"]]
        start = datetime.fromisoformat(data["start"]).replace(tzinfo=CET)
        end = datetime.fromisoformat(data["end"]).replace(tzinfo=CET)
    except Exception:
        raise HTTPException(400, "Ungültige Eingabedaten")

    now = datetime.now(timezone.utc).astimezone(CET)

    # -------------------------------
    # absolute invariants (everyone)
    # -------------------------------
    if start >= end:
        raise HTTPException(400, "Endzeit muss nach Startzeit liegen")

    if role == Role.USER and start < now:
        raise HTTPException(400, "Buchungen in der Vergangenheit sind nicht erlaubt")

    if start > now + timedelta(days=MAX_DAYS_AHEAD):
        raise HTTPException(
            400,
            f"Maximal {MAX_DAYS_AHEAD} Tage im Voraus buchbar"
        )

    # -------------------------------
    # time window (08–22) – everyone
    # -------------------------------
    start_minutes = start.hour * 60 + start.minute
    end_minutes = end.hour * 60 + end.minute

    if start_minutes < MIN_TIME_MINUTES or end_minutes > MAX_TIME_MINUTES:
        raise HTTPException(
            400,
            f"Buchungen nur zwischen {MIN_TIME} und {MAX_TIME} erlaubt"
        )

    # -------------------------------
    # USER-only buffer restriction
    # -------------------------------
    if role == Role.USER:
        buffer_minutes = get_buffer_minutes(resource)
        min_start = now + timedelta(minutes=buffer_minutes)

        if start < min_start:
            raise HTTPException(
                400,
                f"Buchung frühestens ab {min_start.strftime('%H:%M')} Uhr erlaubt"
            )

    # -------------------------------
    # USER-only multi-day restriction
    # -------------------------------
    if role == Role.USER:
        if start.date() != end.date():
            raise HTTPException(
                400,
                "Mehr­tägige Buchungen sind nur für Admins erlaubt"
            )

    # -------------------------------
    # USER-only step size restriction
    # -------------------------------
    if role == Role.USER:
        if start_minutes % STEP_MINUTES != 0 or end_minutes % STEP_MINUTES != 0:
            raise HTTPException(
                400,
                f"Zeiten müssen in {STEP_MINUTES}-Minuten-Schritten liegen"
            )

    # -------------------------------
    # USER-only min/max duration
    # -------------------------------
    duration_minutes = int((end - start).total_seconds() / 60)

    if role == Role.USER:
        rule = RESOURCE_RULES.get(resource)
        if rule:
            if duration_minutes < rule["min_minutes"]:
                raise HTTPException(
                    400,
                    f"Minimale Buchungsdauer: {rule['min_minutes']} Minuten"
                )

            if duration_minutes > rule["max_minutes"]:
                raise HTTPException(
                    400,
                    f"Maximale Buchungsdauer: {rule['max_minutes']} Minuten"
                )

    db = SessionLocal()
    try:
        # -------------------------------
        # USER-only one booking per day
        # -------------------------------
        if role == Role.USER:
            start_day = start.astimezone(CET).date()

            day_start = datetime.combine(
                start_day,
                datetime.min.time(),
                tzinfo=CET
            )
            day_end = day_start + timedelta(days=1)

            existing_same_day = db.query(Booking).filter(
                Booking.room == room.value,
                Booking.resource == resource.value,
                Booking.start >= day_start,
                Booking.start < day_end
            ).first()

            if existing_same_day:
                raise HTTPException(
                    409,
                    f'Pro Tag ist nur eine Buchung für "{resource.value}" erlaubt.'
                )

        # -------------------------------
        # USER-only overlap protection
        # -------------------------------
        if role == Role.USER:
            overlap = db.query(Booking).filter(
                Booking.resource == resource.value,
                Booking.start < end,
                Booking.end > start
            ).first()

            if overlap:
                raise HTTPException(409, "Zeitraum bereits belegt")

        booking = Booking(
            room=room.value,
            resource=resource.value,
            start=start,
            end=end
        )

        db.add(booking)
        db.commit()

    finally:
        db.close()

    return {"status": "gebucht"}


@router.delete("/{booking_id}")
def delete_booking(
    booking_id: int,
    role: Role = Depends(verify_session),
):
    if role != Role.ADMIN:
        raise HTTPException(403, "Nur Admins dürfen löschen")

    db = SessionLocal()
    try:
        booking = db.get(Booking, booking_id)
        if not booking:
            raise HTTPException(404, "Buchung nicht gefunden")

        db.delete(booking)
        db.commit()
    finally:
        db.close()

    return {"status": "gelöscht"}


@router.get("/enums")
def get_enums():
    return {
        "rooms": [
            {"key": room.name, "label": room.value.capitalize()}
            for room in RoomType
        ],
        "resources": [
            {"key": resource.name, "label": resource.value.capitalize()}
            for resource in ResourceType
        ],
        "booking_rules": {
            "min_time": MIN_TIME,
            "max_time": MAX_TIME,
            "step_minutes": STEP_MINUTES,
            "default_duration_minutes": DEFAULT_DURATION_MINNUTES,
            "max_days_ahead": MAX_DAYS_AHEAD,
            "resource_rules": {
                r.name: rules for r, rules in RESOURCE_RULES.items()
            }
        }
    }
