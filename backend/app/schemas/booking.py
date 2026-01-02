from datetime import datetime
from pydantic import BaseModel
from app.enums import RoomType, ResourceType


class BookingCreate(BaseModel):
    room: RoomType
    resource: ResourceType
    start: datetime
    end: datetime
