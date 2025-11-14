import { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import axios from 'axios';
import { toast } from 'sonner';
import 'leaflet/dist/leaflet.css';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MapPin, Truck, AlertCircle, Navigation, Play, Square, Zap, RefreshCw } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Fix for default marker icons
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const vehicleIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

const movingVehicleIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

const routeColors = {
  fastest: '#ef4444',
  economy: '#10b981',
  scenic: '#3b82f6'
};

// Component to auto-center map on vehicle
function MapController({ center }) {
  const map = useMap();
  
  useEffect(() => {
    if (center) {
      map.setView(center, map.getZoom());
    }
  }, [center, map]);
  
  return null;
}

export default function FleetMap({ token, vehicles }) {
  const [center, setCenter] = useState([28.6139, 77.2090]);
  const [zoom] = useState(12);
  const [selectedVehicleId, setSelectedVehicleId] = useState(null);
  const [vehicleLocations, setVehicleLocations] = useState({});
  const [activeRoute, setActiveRoute] = useState(null);
  const [isTracking, setIsTracking] = useState(false);
  const [routeProgress, setRouteProgress] = useState(0);
  const trackingIntervalRef = useRef(null);

  // Initialize vehicle locations
  useEffect(() => {
    const locations = {};
    vehicles.forEach((vehicle, idx) => {
      locations[vehicle.id] = vehicle.current_location || {
        lat: center[0] + (Math.random() - 0.5) * 0.1,
        lng: center[1] + (Math.random() - 0.5) * 0.1
      };
    });
    setVehicleLocations(locations);
  }, [vehicles]);

  const selectedVehicle = vehicles.find(v => v.id === selectedVehicleId);

  const handleVehicleSelect = async (vehicleId) => {
    setSelectedVehicleId(vehicleId);
    setIsTracking(false);
    setActiveRoute(null);
    setRouteProgress(0);
    
    if (trackingIntervalRef.current) {
      clearInterval(trackingIntervalRef.current);
      trackingIntervalRef.current = null;
    }

    if (vehicleId && vehicleLocations[vehicleId]) {
      setCenter([vehicleLocations[vehicleId].lat, vehicleLocations[vehicleId].lng]);
    }
  };

  const handleStartTracking = async () => {
    if (!selectedVehicleId) {
      toast.error('Please select a vehicle first');
      return;
    }

    try {
      // Generate a random destination
      const startLoc = vehicleLocations[selectedVehicleId];
      const endLat = startLoc.lat + (Math.random() - 0.5) * 0.15;
      const endLng = startLoc.lng + (Math.random() - 0.5) * 0.15;

      // Calculate route
      const response = await axios.post(
        `${API}/routes/calculate`,
        {
          start: { lat: startLoc.lat, lng: startLoc.lng },
          end: { lat: endLat, lng: endLng },
          vehicle_fuel_type: selectedVehicle.fuel_type
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const route = response.data[0]; // Use fastest route
      setActiveRoute(route);
      setIsTracking(true);
      setRouteProgress(0);
      toast.success('Started live tracking');

      // Simulate vehicle movement along route
      let progress = 0;
      trackingIntervalRef.current = setInterval(() => {
        progress += 1;
        if (progress > route.coordinates.length - 1) {
          clearInterval(trackingIntervalRef.current);
          trackingIntervalRef.current = null;
          setIsTracking(false);
          toast.success('Vehicle reached destination');
          return;
        }

        const coord = route.coordinates[progress];
        const newLoc = { lat: coord[1], lng: coord[0] };
        
        setVehicleLocations(prev => ({
          ...prev,
          [selectedVehicleId]: newLoc
        }));
        
        setCenter([newLoc.lat, newLoc.lng]);
        setRouteProgress(progress);

        // Update location in backend
        axios.put(
          `${API}/vehicles/${selectedVehicleId}/location`,
          newLoc,
          { headers: { Authorization: `Bearer ${token}` } }
        ).catch(() => {});
      }, 1000); // Move every 1 second
    } catch (error) {
      toast.error('Failed to start tracking');
    }
  };

  const handleStopTracking = () => {
    if (trackingIntervalRef.current) {
      clearInterval(trackingIntervalRef.current);
      trackingIntervalRef.current = null;
    }
    setIsTracking(false);
    toast.info('Tracking stopped');
  };

  const handleRefreshLocation = () => {
    if (selectedVehicleId && vehicleLocations[selectedVehicleId]) {
      setCenter([vehicleLocations[selectedVehicleId].lat, vehicleLocations[selectedVehicleId].lng]);
      toast.success('Map centered on vehicle');
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (trackingIntervalRef.current) {
        clearInterval(trackingIntervalRef.current);
      }
    };
  }, []);

  return (
    <div className="space-y-4" data-testid="fleet-map-container">
      {/* Control Panel */}
      <Card className="shadow-lg">
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4 items-start md:items-center">
            <div className="flex-1 space-y-2">
              <label className="text-sm font-medium">Select Vehicle to Track</label>
              <Select value={selectedVehicleId || ''} onValueChange={handleVehicleSelect}>
                <SelectTrigger data-testid="vehicle-select">
                  <SelectValue placeholder="Choose a vehicle" />
                </SelectTrigger>
                <SelectContent>
                  {vehicles.map((vehicle) => (
                    <SelectItem key={vehicle.id} value={vehicle.id}>
                      {vehicle.name} - {vehicle.registration_number}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-2">
              {!isTracking ? (
                <Button
                  onClick={handleStartTracking}
                  disabled={!selectedVehicleId}
                  className="gap-2"
                  data-testid="start-tracking-button"
                  style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)' }}
                >
                  <Play className="w-4 h-4" />
                  Start Tracking
                </Button>
              ) : (
                <Button
                  onClick={handleStopTracking}
                  className="gap-2 bg-red-600 hover:bg-red-700"
                  data-testid="stop-tracking-button"
                >
                  <Square className="w-4 h-4" />
                  Stop Tracking
                </Button>
              )}
              
              <Button
                onClick={handleRefreshLocation}
                disabled={!selectedVehicleId}
                variant="outline"
                size="icon"
                data-testid="refresh-location-button"
              >
                <RefreshCw className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {isTracking && activeRoute && (
            <div className="mt-4 p-3 bg-green-50 rounded-lg border border-green-200">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 text-green-700 font-medium">
                  <Zap className="w-4 h-4 animate-pulse" />
                  <span>Live Tracking Active</span>
                </div>
                <Badge className="bg-green-600">
                  {Math.round((routeProgress / (activeRoute.coordinates.length - 1)) * 100)}% Complete
                </Badge>
              </div>
              <div className="text-sm text-gray-600">
                <span>Distance: {activeRoute.distance} km</span>
                <span className="mx-2">•</span>
                <span>ETA: {Math.round(activeRoute.duration * (1 - routeProgress / activeRoute.coordinates.length))} min</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Map */}
      <Card className="shadow-lg border-0 overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white">
          <CardTitle className="flex items-center gap-2" style={{ fontFamily: 'Space Grotesk' }}>
            <MapPin className="w-5 h-5" />
            Live Fleet Tracking
          </CardTitle>
          <CardDescription className="text-white/90">
            {selectedVehicle ? `Tracking: ${selectedVehicle.name}` : 'Real-time location of all your vehicles'}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div style={{ height: '600px', width: '100%' }} data-testid="map-view">
            <MapContainer
              center={center}
              zoom={zoom}
              style={{ height: '100%', width: '100%' }}
              scrollWheelZoom={true}
            >
              <MapController center={center} />
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              
              {/* Show route if tracking */}
              {activeRoute && (
                <>
                  <Polyline
                    positions={activeRoute.coordinates.map(coord => [coord[1], coord[0]])}
                    color={routeColors.fastest}
                    weight={5}
                    opacity={0.7}
                  />
                  
                  {/* Show toll locations */}
                  {activeRoute.tolls.map((toll, idx) => (
                    <Marker
                      key={idx}
                      position={[toll.location.lat, toll.location.lng]}
                    >
                      <Popup>
                        <div className="p-2">
                          <h4 className="font-semibold text-sm">{toll.name}</h4>
                          <p className="text-xs text-gray-600">Amount: ₹{toll.amount}</p>
                        </div>
                      </Popup>
                    </Marker>
                  ))}
                </>
              )}
              
              {/* Show all vehicles */}
              {Object.keys(vehicleLocations).map((vehicleId) => {
                const vehicle = vehicles.find(v => v.id === vehicleId);
                const location = vehicleLocations[vehicleId];
                const isSelected = vehicleId === selectedVehicleId;
                const isMoving = isTracking && isSelected;
                
                return (
                  <Marker
                    key={vehicleId}
                    position={[location.lat, location.lng]}
                    icon={isMoving ? movingVehicleIcon : vehicleIcon}
                  >
                    <Popup>
                      <div className="p-2" data-testid={`vehicle-popup-${vehicleId}`}>
                        <div className="flex items-center gap-2 mb-2">
                          <Truck className="w-4 h-4 text-purple-600" />
                          <h3 className="font-semibold text-sm">{vehicle.name}</h3>
                        </div>
                        <div className="space-y-1 text-xs text-gray-600">
                          <p><strong>Type:</strong> {vehicle.vehicle_type}</p>
                          <p><strong>Reg:</strong> {vehicle.registration_number}</p>
                          <p><strong>Fuel:</strong> {vehicle.fuel_type}</p>
                          <p><strong>Location:</strong> {location.lat.toFixed(4)}, {location.lng.toFixed(4)}</p>
                          {isMoving && (
                            <Badge className="bg-green-500 mt-1">
                              <Zap className="w-3 h-3 mr-1" />
                              Moving
                            </Badge>
                          )}
                        </div>
                      </div>
                    </Popup>
                  </Marker>
                );
              })}
            </MapContainer>
          </div>
        </CardContent>
      </Card>

      {/* Fleet Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="shadow-lg">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Total Vehicles</p>
                <p className="text-3xl font-bold text-gray-900" data-testid="total-vehicles-count">{vehicles.length}</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-purple-100 flex items-center justify-center">
                <Truck className="w-6 h-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-lg">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Tracking Active</p>
                <p className="text-3xl font-bold text-green-600" data-testid="tracking-active">
                  {isTracking ? '1' : '0'}
                </p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center">
                <Navigation className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-lg">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Active Routes</p>
                <p className="text-3xl font-bold text-blue-600" data-testid="active-routes">
                  {activeRoute ? '1' : '0'}
                </p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center">
                <MapPin className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
