import os
from dotenv import load_dotenv
from app.enums import ResourceType

load_dotenv()

USER_PASSWORD = os.getenv("USER_PASSWORD")
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD")
SESSION_SECRET = os.getenv("SESSION_SECRET")

if not all([USER_PASSWORD, ADMIN_PASSWORD, SESSION_SECRET]):
    raise RuntimeError("Sicherheits-ENV fehlt")

# consts
MAX_DAYS_AHEAD = 14
MIN_TIME = "08:00"
MAX_TIME = "22:00"
STEP_MINUTES = 15
DEFAULT_DURATION_MINNUTES = 60

RESOURCE_RULES = {
    ResourceType.SAUNA: {
        "max_minutes": 120,
        "min_minutes": 30,
        "buffer_minutes": 60,  # Vorlauf
    },
    ResourceType.GRILL: {
        "max_minutes": 240,
        "min_minutes": 30,
        "buffer_minutes": 60,   # Vorlauf
    },
}
