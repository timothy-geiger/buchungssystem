from enum import Enum


class Role(str, Enum):
    USER = "user"
    ADMIN = "admin"


class ResourceType(str, Enum):
    SAUNA = "Sauna"
    GRILL = "Grillhütte"


class RoomType(str, Enum):
    WOLF = "Wolf"
    HERMLIN = "Hermelin"
    FUCHS = "Fuchs"
    BIBER = "Biber"
