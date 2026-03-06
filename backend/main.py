from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from pydantic import BaseModel
import random
import models

# Initialize Database
models.Base.metadata.create_all(bind=models.engine)

app = FastAPI(title="AquaAI Core Engine")

# Crucial for local frontend to talk to backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def get_db():
    db = models.SessionLocal()
    try:
        yield db
    finally:
        db.close()

# --- Schemas ---
class PondCreate(BaseModel):
    name: str
    species: str
    fish_count: int

class PondResponse(PondCreate):
    id: int
    class Config:
        from_attributes = True

# --- General Endpoints ---
@app.get("/ponds/", response_model=list[PondResponse])
def get_ponds(db: Session = Depends(get_db)):
    return db.query(models.Pond).all()

@app.post("/ponds/", response_model=PondResponse)
def create_pond(pond: PondCreate, db: Session = Depends(get_db)):
    db_pond = models.Pond(**pond.model_dump())
    db.add(db_pond)
    db.commit()
    db.refresh(db_pond)
    return db_pond

@app.delete("/ponds/{pond_id}")
def delete_pond(pond_id: int, db: Session = Depends(get_db)):
    pond = db.query(models.Pond).filter(models.Pond.id == pond_id).first()
    if not pond:
        raise HTTPException(status_code=404, detail="Pond not found")
    db.delete(pond)
    db.commit()
    return {"status": "success"}

# --- AI Endpoints (Mocked for robust offline execution) ---

@app.get("/ai/dashboard")
def get_ai_dashboard_metrics(db: Session = Depends(get_db)):
    count = db.query(models.Pond).count()
    return {
        "active_ponds": count,
        "total_biomass_kg": count * random.randint(3000, 6000),
        "disease_risk": "Low",
        "system_status": "Online"
    }

@app.post("/ai/analyze")
def run_ai_analysis(pond_id: int):
    # Simulates the 7-module AI architecture running an assessment
    ph = round(random.uniform(6.5, 8.5), 1)
    temp = round(random.uniform(24.0, 30.0), 1)
    
    anomalies = []
    if ph < 7.0: anomalies.append("Slightly Acidic pH")
    if temp > 28.0: anomalies.append("High Temperature")
    
    status = "Warning" if anomalies else "Optimal"
    
    return {
        "pond_id": pond_id,
        "water_quality": status,
        "ph": ph,
        "temperature": temp,
        "growth_prediction_days_to_harvest": random.randint(20, 90),
        "feed_recommendation_kg": random.randint(40, 100),
        "disease_detected": "None",
        "notes": " | ".join(anomalies) if anomalies else "All parameters look great."
    }

@app.post("/ai/chat")
def ai_assistant_chat(query: str):
    q = query.lower()
    if "die" in q or "disease" in q or "sick" in q:
        reply = "I recommend checking the Ammonia and Dissolved Oxygen levels immediately. Would you like me to run a Vision Agent scan on the latest pond images?"
    elif "feed" in q or "eat" in q:
        reply = "Based on current biomass estimates, you should prepare approximately 45kg of high-protein feed for the next cycle."
    elif "harvest" in q or "grow" in q:
        reply = "Our time-series models predict the current stock will reach optimal harvest weight in exactly 38 days."
    else:
        reply = "I am AquaAI, your farm operating system. I can help with growth predictions, feed optimization, and disease detection."
        
    return {"reply": reply}
