from fastapi import FastAPI, APIRouter, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import List, Optional
import uuid
from datetime import datetime, timezone, timedelta
from passlib.context import CryptContext
from jose import JWTError, jwt
import random
import math

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# JWT Configuration
SECRET_KEY = os.environ.get('SECRET_KEY', 'your-secret-key-change-in-production')
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24  # 24 hours

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer()

# Create the main app
app = FastAPI()
api_router = APIRouter(prefix="/api")

# Models
class UserRegister(BaseModel):
    email: EmailStr
    password: str
    name: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class User(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    email: EmailStr
    name: str
    hashed_password: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class Vehicle(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    name: str
    vehicle_type: str  # car, truck, bike
    registration_number: str
    fuel_type: str  # petrol, diesel, electric
    current_location: Optional[dict] = None  # {lat, lng}
    is_active: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class VehicleCreate(BaseModel):
    name: str
    vehicle_type: str
    registration_number: str
    fuel_type: str

class RouteRequest(BaseModel):
    start: dict  # {lat, lng}
    end: dict  # {lat, lng}
    vehicle_fuel_type: str

class Route(BaseModel):
    route_type: str  # fastest, economy, scenic
    distance: float  # in km
    duration: float  # in minutes
    coordinates: List[List[float]]
    tolls: List[dict]
    fuel_consumption: float  # estimated liters
    estimated_cost: float  # estimated cost

class Trip(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    vehicle_id: str
    start_location: dict
    end_location: dict
    route_type: str
    distance: float
    duration: float
    status: str  # planned, in_progress, completed
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class TripCreate(BaseModel):
    vehicle_id: str
    start_location: dict
    end_location: dict
    route_type: str
    distance: float
    duration: float

class FASTagTransaction(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    vehicle_id: str
    toll_name: str
    amount: float
    location: dict
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    status: str  # success, failed

class FASTagPayment(BaseModel):
    vehicle_id: str
    toll_name: str
    amount: float
    location: dict

class Location(BaseModel):
    name: str
    type: str  # petrol_pump, charging_station
    lat: float
    lng: float
    address: str
    amenities: List[str]

# Helper Functions
def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    return pwd_context.hash(password)

def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    token = credentials.credentials
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid authentication credentials")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid authentication credentials")
    
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if user is None:
        raise HTTPException(status_code=401, detail="User not found")
    return User(**user)

def calculate_distance(lat1, lon1, lat2, lon2):
    """Calculate distance between two coordinates using Haversine formula"""
    R = 6371  # Radius of Earth in kilometers
    
    lat1_rad = math.radians(lat1)
    lat2_rad = math.radians(lat2)
    delta_lat = math.radians(lat2 - lat1)
    delta_lon = math.radians(lon2 - lon1)
    
    a = math.sin(delta_lat / 2) ** 2 + math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(delta_lon / 2) ** 2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    
    distance = R * c
    return distance

def generate_route_coordinates(start, end, waypoints_count=5):
    """Generate intermediate coordinates for route visualization"""
    coordinates = [[start['lng'], start['lat']]]
    
    for i in range(1, waypoints_count):
        progress = i / waypoints_count
        lat = start['lat'] + (end['lat'] - start['lat']) * progress + (random.random() - 0.5) * 0.01
        lng = start['lng'] + (end['lng'] - start['lng']) * progress + (random.random() - 0.5) * 0.01
        coordinates.append([lng, lat])
    
    coordinates.append([end['lng'], end['lat']])
    return coordinates

def generate_toll_locations(coordinates, count=2):
    """Generate mock toll locations along the route"""
    tolls = []
    for i in range(count):
        idx = int(len(coordinates) * (i + 1) / (count + 1))
        if idx < len(coordinates):
            tolls.append({
                "name": f"Toll Plaza {i + 1}",
                "location": {"lat": coordinates[idx][1], "lng": coordinates[idx][0]},
                "amount": random.randint(30, 150)
            })
    return tolls

# Auth Routes
@api_router.post("/auth/register")
async def register(user_data: UserRegister):
    # Check if user exists
    existing_user = await db.users.find_one({"email": user_data.email}, {"_id": 0})
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Create user
    user = User(
        email=user_data.email,
        name=user_data.name,
        hashed_password=get_password_hash(user_data.password)
    )
    
    user_dict = user.model_dump()
    user_dict['created_at'] = user_dict['created_at'].isoformat()
    
    await db.users.insert_one(user_dict)
    
    # Create token
    access_token = create_access_token(data={"sub": user.id})
    
    return {
        "token": access_token,
        "user": {
            "id": user.id,
            "email": user.email,
            "name": user.name
        }
    }

@api_router.post("/auth/login")
async def login(credentials: UserLogin):
    user = await db.users.find_one({"email": credentials.email}, {"_id": 0})
    if not user or not verify_password(credentials.password, user['hashed_password']):
        raise HTTPException(status_code=401, detail="Incorrect email or password")
    
    access_token = create_access_token(data={"sub": user['id']})
    
    return {
        "token": access_token,
        "user": {
            "id": user['id'],
            "email": user['email'],
            "name": user['name']
        }
    }

@api_router.get("/auth/me")
async def get_me(current_user: User = Depends(get_current_user)):
    return {
        "id": current_user.id,
        "email": current_user.email,
        "name": current_user.name
    }

# Vehicle Routes
@api_router.post("/vehicles")
async def create_vehicle(vehicle_data: VehicleCreate, current_user: User = Depends(get_current_user)):
    vehicle = Vehicle(
        user_id=current_user.id,
        **vehicle_data.model_dump()
    )
    
    vehicle_dict = vehicle.model_dump()
    vehicle_dict['created_at'] = vehicle_dict['created_at'].isoformat()
    
    await db.vehicles.insert_one(vehicle_dict)
    return vehicle

@api_router.get("/vehicles", response_model=List[Vehicle])
async def get_vehicles(current_user: User = Depends(get_current_user)):
    vehicles = await db.vehicles.find({"user_id": current_user.id}, {"_id": 0}).to_list(100)
    for vehicle in vehicles:
        if isinstance(vehicle.get('created_at'), str):
            vehicle['created_at'] = datetime.fromisoformat(vehicle['created_at'])
    return vehicles

@api_router.put("/vehicles/{vehicle_id}/location")
async def update_vehicle_location(vehicle_id: str, location: dict, current_user: User = Depends(get_current_user)):
    result = await db.vehicles.update_one(
        {"id": vehicle_id, "user_id": current_user.id},
        {"$set": {"current_location": location}}
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    return {"message": "Location updated"}

@api_router.delete("/vehicles/{vehicle_id}")
async def delete_vehicle(vehicle_id: str, current_user: User = Depends(get_current_user)):
    result = await db.vehicles.delete_one({"id": vehicle_id, "user_id": current_user.id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    return {"message": "Vehicle deleted"}

# Route Calculation
@api_router.post("/routes/calculate")
async def calculate_routes(route_req: RouteRequest, current_user: User = Depends(get_current_user)):
    start = route_req.start
    end = route_req.end
    
    base_distance = calculate_distance(start['lat'], start['lng'], end['lat'], end['lng'])
    
    routes = []
    
    # Fastest Route
    fastest_coords = generate_route_coordinates(start, end, 5)
    fastest_tolls = generate_toll_locations(fastest_coords, 2)
    fastest_distance = base_distance
    fastest_duration = (fastest_distance / 80) * 60  # Assuming 80 km/h average
    fastest_fuel = fastest_distance * 0.08  # 8L per 100km
    
    routes.append(Route(
        route_type="fastest",
        distance=round(fastest_distance, 2),
        duration=round(fastest_duration, 2),
        coordinates=fastest_coords,
        tolls=fastest_tolls,
        fuel_consumption=round(fastest_fuel, 2),
        estimated_cost=round(fastest_fuel * 100 + sum(t['amount'] for t in fastest_tolls), 2)
    ))
    
    # Economy Route
    economy_coords = generate_route_coordinates(start, end, 7)
    economy_tolls = generate_toll_locations(economy_coords, 1)
    economy_distance = base_distance * 1.1  # 10% longer
    economy_duration = (economy_distance / 60) * 60  # Slower, 60 km/h
    economy_fuel = economy_distance * 0.06  # More fuel efficient
    
    routes.append(Route(
        route_type="economy",
        distance=round(economy_distance, 2),
        duration=round(economy_duration, 2),
        coordinates=economy_coords,
        tolls=economy_tolls,
        fuel_consumption=round(economy_fuel, 2),
        estimated_cost=round(economy_fuel * 100 + sum(t['amount'] for t in economy_tolls), 2)
    ))
    
    # Scenic Route
    scenic_coords = generate_route_coordinates(start, end, 10)
    scenic_tolls = generate_toll_locations(scenic_coords, 1)
    scenic_distance = base_distance * 1.2  # 20% longer
    scenic_duration = (scenic_distance / 65) * 60  # 65 km/h
    scenic_fuel = scenic_distance * 0.07
    
    routes.append(Route(
        route_type="scenic",
        distance=round(scenic_distance, 2),
        duration=round(scenic_duration, 2),
        coordinates=scenic_coords,
        tolls=scenic_tolls,
        fuel_consumption=round(scenic_fuel, 2),
        estimated_cost=round(scenic_fuel * 100 + sum(t['amount'] for t in scenic_tolls), 2)
    ))
    
    return routes

# Locations (Petrol Pumps & Charging Stations)
@api_router.get("/locations/nearby")
async def get_nearby_locations(lat: float, lng: float, type: str, radius: float = 50.0, current_user: User = Depends(get_current_user)):
    # Mock data - in production, use actual location database
    locations = []
    
    # Generate some random nearby locations
    for i in range(5):
        offset_lat = (random.random() - 0.5) * (radius / 111)  # 111 km per degree
        offset_lng = (random.random() - 0.5) * (radius / 111)
        
        loc = Location(
            name=f"{type.replace('_', ' ').title()} {i + 1}",
            type=type,
            lat=lat + offset_lat,
            lng=lng + offset_lng,
            address=f"Location {i + 1} Address",
            amenities=["24/7", "ATM", "Restroom"] if type == "petrol_pump" else ["Fast Charging", "Cafe", "Parking"]
        )
        locations.append(loc.model_dump())
    
    return locations

# Trips
@api_router.post("/trips")
async def create_trip(trip_data: TripCreate, current_user: User = Depends(get_current_user)):
    trip = Trip(
        user_id=current_user.id,
        status="planned",
        **trip_data.model_dump()
    )
    
    trip_dict = trip.model_dump()
    trip_dict['created_at'] = trip_dict['created_at'].isoformat()
    if trip_dict.get('started_at'):
        trip_dict['started_at'] = trip_dict['started_at'].isoformat()
    if trip_dict.get('completed_at'):
        trip_dict['completed_at'] = trip_dict['completed_at'].isoformat()
    
    await db.trips.insert_one(trip_dict)
    return trip

@api_router.get("/trips", response_model=List[Trip])
async def get_trips(current_user: User = Depends(get_current_user)):
    trips = await db.trips.find({"user_id": current_user.id}, {"_id": 0}).sort("created_at", -1).to_list(100)
    for trip in trips:
        if isinstance(trip.get('created_at'), str):
            trip['created_at'] = datetime.fromisoformat(trip['created_at'])
        if trip.get('started_at') and isinstance(trip['started_at'], str):
            trip['started_at'] = datetime.fromisoformat(trip['started_at'])
        if trip.get('completed_at') and isinstance(trip['completed_at'], str):
            trip['completed_at'] = datetime.fromisoformat(trip['completed_at'])
    return trips

@api_router.put("/trips/{trip_id}/start")
async def start_trip(trip_id: str, current_user: User = Depends(get_current_user)):
    result = await db.trips.update_one(
        {"id": trip_id, "user_id": current_user.id},
        {"$set": {"status": "in_progress", "started_at": datetime.now(timezone.utc).isoformat()}}
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Trip not found")
    return {"message": "Trip started"}

@api_router.put("/trips/{trip_id}/complete")
async def complete_trip(trip_id: str, current_user: User = Depends(get_current_user)):
    result = await db.trips.update_one(
        {"id": trip_id, "user_id": current_user.id},
        {"$set": {"status": "completed", "completed_at": datetime.now(timezone.utc).isoformat()}}
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Trip not found")
    return {"message": "Trip completed"}

# FASTag Transactions
@api_router.post("/fastag/process")
async def process_fastag_payment(payment: FASTagPayment, current_user: User = Depends(get_current_user)):
    # Mock FASTag payment processing
    transaction = FASTagTransaction(
        user_id=current_user.id,
        vehicle_id=payment.vehicle_id,
        toll_name=payment.toll_name,
        amount=payment.amount,
        location=payment.location,
        status="success" if random.random() > 0.05 else "failed"  # 95% success rate
    )
    
    transaction_dict = transaction.model_dump()
    transaction_dict['timestamp'] = transaction_dict['timestamp'].isoformat()
    
    await db.fastag_transactions.insert_one(transaction_dict)
    return transaction

@api_router.get("/fastag/transactions", response_model=List[FASTagTransaction])
async def get_fastag_transactions(current_user: User = Depends(get_current_user)):
    transactions = await db.fastag_transactions.find({"user_id": current_user.id}, {"_id": 0}).sort("timestamp", -1).to_list(100)
    for txn in transactions:
        if isinstance(txn.get('timestamp'), str):
            txn['timestamp'] = datetime.fromisoformat(txn['timestamp'])
    return transactions

# Safety Features
@api_router.get("/safety/alerts")
async def get_safety_alerts(lat: float, lng: float, current_user: User = Depends(get_current_user)):
    # Mock safety alerts
    alerts = [
        {
            "type": "weather",
            "severity": "moderate",
            "message": "Heavy rain expected in 2 hours",
            "location": {"lat": lat, "lng": lng}
        },
        {
            "type": "traffic",
            "severity": "low",
            "message": "Light traffic on route",
            "location": {"lat": lat + 0.01, "lng": lng + 0.01}
        },
        {
            "type": "roadwork",
            "severity": "high",
            "message": "Road construction ahead - expect delays",
            "location": {"lat": lat + 0.02, "lng": lng - 0.01}
        }
    ]
    return alerts

# Include router
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
