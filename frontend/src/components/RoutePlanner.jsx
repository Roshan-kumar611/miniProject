import { useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { MapContainer, TileLayer, Polyline, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Navigation, DollarSign, Fuel, Clock, MapPin, Zap, TrendingDown, Eye, IndianRupee } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const routeColors = {
  fastest: '#ef4444',
  economy: '#10b981',
  scenic: '#3b82f6'
};

const startIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

const endIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

export default function RoutePlanner({ token, vehicles }) {
  const [isLoading, setIsLoading] = useState(false);
  const [routes, setRoutes] = useState(null);
  const [selectedRoute, setSelectedRoute] = useState(null);
  const [formData, setFormData] = useState({
    vehicle_id: '',
    start_lat: '28.6139',
    start_lng: '77.2090',
    end_lat: '28.7041',
    end_lng: '77.1025'
  });

  const handleCalculate = async (e) => {
    e.preventDefault();
    
    if (!formData.vehicle_id) {
      toast.error('Please select a vehicle');
      return;
    }

    setIsLoading(true);
    try {
      const vehicle = vehicles.find(v => v.id === formData.vehicle_id);
      const response = await axios.post(
        `${API}/routes/calculate`,
        {
          start: { lat: parseFloat(formData.start_lat), lng: parseFloat(formData.start_lng) },
          end: { lat: parseFloat(formData.end_lat), lng: parseFloat(formData.end_lng) },
          vehicle_fuel_type: vehicle.fuel_type
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setRoutes(response.data);
      setSelectedRoute(response.data[0]);
      toast.success('Routes calculated successfully');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to calculate routes');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveTrip = async (route) => {
    try {
      await axios.post(
        `${API}/trips`,
        {
          vehicle_id: formData.vehicle_id,
          start_location: { lat: parseFloat(formData.start_lat), lng: parseFloat(formData.start_lng) },
          end_location: { lat: parseFloat(formData.end_lat), lng: parseFloat(formData.end_lng) },
          route_type: route.route_type,
          distance: route.distance,
          duration: route.duration
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Trip saved successfully');
    } catch (error) {
      toast.error('Failed to save trip');
    }
  };

  return (
    <div className="space-y-6" data-testid="route-planner-container">
      <div>
        <h2 className="text-3xl font-bold text-gray-900" style={{ fontFamily: 'Space Grotesk' }}>Route Planner</h2>
        <p className="text-gray-500 mt-1">Calculate optimal routes for your trips</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Route Form */}
        <Card className="shadow-lg lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Navigation className="w-5 h-5" />
              Trip Details
            </CardTitle>
            <CardDescription>Enter start and end locations</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCalculate} className="space-y-4" data-testid="route-form">
              <div className="space-y-2">
                <Label htmlFor="vehicle">Select Vehicle</Label>
                <Select value={formData.vehicle_id} onValueChange={(value) => setFormData({ ...formData, vehicle_id: value })}>
                  <SelectTrigger data-testid="route-vehicle-select">
                    <SelectValue placeholder="Choose a vehicle" />
                  </SelectTrigger>
                  <SelectContent>
                    {vehicles.map((vehicle) => (
                      <SelectItem key={vehicle.id} value={vehicle.id}>
                        {vehicle.name} ({vehicle.registration_number})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-3 p-4 bg-green-50 rounded-lg border border-green-200">
                <div className="flex items-center gap-2 text-green-700 font-medium">
                  <MapPin className="w-4 h-4" />
                  <span>Start Location</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label htmlFor="start_lat" className="text-xs">Latitude</Label>
                    <Input
                      id="start_lat"
                      data-testid="start-lat-input"
                      type="number"
                      step="any"
                      value={formData.start_lat}
                      onChange={(e) => setFormData({ ...formData, start_lat: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="start_lng" className="text-xs">Longitude</Label>
                    <Input
                      id="start_lng"
                      data-testid="start-lng-input"
                      type="number"
                      step="any"
                      value={formData.start_lng}
                      onChange={(e) => setFormData({ ...formData, start_lng: e.target.value })}
                      required
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-3 p-4 bg-red-50 rounded-lg border border-red-200">
                <div className="flex items-center gap-2 text-red-700 font-medium">
                  <MapPin className="w-4 h-4" />
                  <span>End Location</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label htmlFor="end_lat" className="text-xs">Latitude</Label>
                    <Input
                      id="end_lat"
                      data-testid="end-lat-input"
                      type="number"
                      step="any"
                      value={formData.end_lat}
                      onChange={(e) => setFormData({ ...formData, end_lat: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="end_lng" className="text-xs">Longitude</Label>
                    <Input
                      id="end_lng"
                      data-testid="end-lng-input"
                      type="number"
                      step="any"
                      value={formData.end_lng}
                      onChange={(e) => setFormData({ ...formData, end_lng: e.target.value })}
                      required
                    />
                  </div>
                </div>
              </div>

              <Button 
                type="submit" 
                className="w-full" 
                disabled={isLoading || vehicles.length === 0}
                data-testid="calculate-routes-button"
                style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}
              >
                {isLoading ? 'Calculating...' : 'Calculate Routes'}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Map & Routes */}
        <div className="lg:col-span-2 space-y-6">
          {routes && (
            <>
              {/* Route Options */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {routes.map((route) => (
                  <Card
                    key={route.route_type}
                    className={`cursor-pointer shadow-lg transition-all hover:shadow-xl ${
                      selectedRoute?.route_type === route.route_type ? 'ring-2 ring-purple-600' : ''
                    }`}
                    onClick={() => setSelectedRoute(route)}
                    data-testid={`route-option-${route.route_type}`}
                  >
                    <CardContent className="p-6">
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {route.route_type === 'fastest' && <Zap className="w-5 h-5 text-red-500" />}
                            {route.route_type === 'economy' && <TrendingDown className="w-5 h-5 text-green-500" />}
                            {route.route_type === 'scenic' && <Eye className="w-5 h-5 text-blue-500" />}
                            <h3 className="font-bold text-lg capitalize">{route.route_type}</h3>
                          </div>
                        </div>
                        
                        <div className="space-y-2 text-sm">
                          <div className="flex items-center gap-2 text-gray-600">
                            <Navigation className="w-4 h-4" />
                            <span>{route.distance} km</span>
                          </div>
                          <div className="flex items-center gap-2 text-gray-600">
                            <Clock className="w-4 h-4" />
                            <span>{Math.round(route.duration)} min</span>
                          </div>
                          <div className="flex items-center gap-2 text-gray-600">
                            <Fuel className="w-4 h-4" />
                            <span>{route.fuel_consumption} L</span>
                          </div>
                          <div className="flex items-center gap-2 font-semibold text-gray-900">
                            <IndianRupee className="w-4 h-4" />
                            <span>₹{route.estimated_cost}</span>
                          </div>
                        </div>

                        <Badge 
                          className="w-full justify-center"
                          style={{ backgroundColor: routeColors[route.route_type] }}
                        >
                          {route.tolls.length} Toll{route.tolls.length !== 1 ? 's' : ''}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Map */}
              <Card className="shadow-lg">
                <CardHeader>
                  <CardTitle className="capitalize">{selectedRoute?.route_type} Route</CardTitle>
                  <CardDescription>View route on map</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  <div style={{ height: '500px', width: '100%' }} data-testid="route-map">
                    <MapContainer
                      center={[parseFloat(formData.start_lat), parseFloat(formData.start_lng)]}
                      zoom={11}
                      style={{ height: '100%', width: '100%' }}
                      scrollWheelZoom={true}
                    >
                      <TileLayer
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                      />
                      
                      <Marker position={[parseFloat(formData.start_lat), parseFloat(formData.start_lng)]} icon={startIcon}>
                        <Popup>Start Location</Popup>
                      </Marker>
                      
                      <Marker position={[parseFloat(formData.end_lat), parseFloat(formData.end_lng)]} icon={endIcon}>
                        <Popup>End Location</Popup>
                      </Marker>

                      {selectedRoute && (
                        <Polyline
                          positions={selectedRoute.coordinates.map(coord => [coord[1], coord[0]])}
                          color={routeColors[selectedRoute.route_type]}
                          weight={4}
                          opacity={0.7}
                        />
                      )}
                    </MapContainer>
                  </div>
                </CardContent>
              </Card>

              {/* Save Trip Button */}
              <Button
                onClick={() => handleSaveTrip(selectedRoute)}
                className="w-full"
                size="lg"
                data-testid="save-trip-button"
                style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}
              >
                Save This Trip
              </Button>
            </>
          )}

          {!routes && (
            <Card className="shadow-lg">
              <CardContent className="p-12 text-center">
                <Navigation className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">No Routes Yet</h3>
                <p className="text-gray-500">Enter trip details and calculate routes to get started</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
