from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.db.database import engine
from app.db.models import Base
from app.routers import auth, bookings

Base.metadata.create_all(bind=engine)

app = FastAPI(title="Buchungssystem")

app.include_router(auth.router)
app.include_router(bookings.router)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
def startup():
    print("🚀 Server gestartet")
    for r in app.routes:
        if hasattr(r, "methods"):
            print(",".join(r.methods), r.path)
