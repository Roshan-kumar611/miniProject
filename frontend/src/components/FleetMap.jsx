import { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, Circle } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MapPin, Truck, AlertCircle } from 'lucide-react';

// Fix for default marker icons in React-Leaflet
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

export default function FleetMap({ token, vehicles }) {
  const [center] = useState([28.6139, 77.2090]); // Default: Delhi, India
  const [zoom] = useState(12);

  // Simulate vehicle locations if not set
  const vehiclesWithLocations = vehicles.map((vehicle, idx) => ({
    ...vehicle,
    current_location: vehicle.current_location || {
      lat: center[0] + (Math.random() - 0.5) * 0.1,
      lng: center[1] + (Math.random() - 0.5) * 0.1
    }
  }));

  return (
    <div className="space-y-4" data-testid="fleet-map-container">
      <Card className="shadow-lg border-0 overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white">
          <CardTitle className="flex items-center gap-2" style={{ fontFamily: 'Space Grotesk' }}>
            <MapPin className="w-5 h-5" />
            Live Fleet Tracking
          </CardTitle>
          <CardDescription className="text-white/90">
            Real-time location of all your vehicles
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
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              
              {vehiclesWithLocations.map((vehicle) => (
                <Marker
                  key={vehicle.id}
                  position={[vehicle.current_location.lat, vehicle.current_location.lng]}
                  icon={vehicleIcon}
                >
                  <Popup>
                    <div className="p-2" data-testid={`vehicle-popup-${vehicle.id}`}>
                      <div className="flex items-center gap-2 mb-2">
                        <Truck className="w-4 h-4 text-purple-600" />
                        <h3 className="font-semibold text-sm">{vehicle.name}</h3>
                      </div>
                      <div className="space-y-1 text-xs text-gray-600">
                        <p><strong>Type:</strong> {vehicle.vehicle_type}</p>
                        <p><strong>Reg:</strong> {vehicle.registration_number}</p>
                        <p><strong>Fuel:</strong> {vehicle.fuel_type}</p>
                        <Badge className={vehicle.is_active ? 'bg-green-500' : 'bg-gray-400'}>
                          {vehicle.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </div>
                    </div>
                  </Popup>
                </Marker>
              ))}
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
                <p className="text-sm text-gray-500">Active Now</p>
                <p className="text-3xl font-bold text-green-600" data-testid="active-vehicles-count">
                  {vehicles.filter(v => v.is_active).length}
                </p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center">
                <MapPin className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-lg">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Inactive</p>
                <p className="text-3xl font-bold text-gray-400" data-testid="inactive-vehicles-count">
                  {vehicles.filter(v => !v.is_active).length}
                </p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center">
                <AlertCircle className="w-6 h-6 text-gray-400" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
