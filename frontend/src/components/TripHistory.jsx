import { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { History, MapPin, Navigation, Clock, Calendar, Play, CheckCircle } from 'lucide-react';
import { format } from 'date-fns';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const statusColors = {
  planned: 'bg-blue-500',
  in_progress: 'bg-yellow-500',
  completed: 'bg-green-500'
};

export default function TripHistory({ token, vehicles }) {
  const [trips, setTrips] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchTrips();
  }, []);

  const fetchTrips = async () => {
    setIsLoading(true);
    try {
      const response = await axios.get(`${API}/trips`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setTrips(response.data);
    } catch (error) {
      toast.error('Failed to fetch trips');
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartTrip = async (tripId) => {
    try {
      await axios.put(`${API}/trips/${tripId}/start`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Trip started');
      fetchTrips();
    } catch (error) {
      toast.error('Failed to start trip');
    }
  };

  const handleCompleteTrip = async (tripId) => {
    try {
      await axios.put(`${API}/trips/${tripId}/complete`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Trip completed');
      fetchTrips();
    } catch (error) {
      toast.error('Failed to complete trip');
    }
  };

  const getVehicleName = (vehicleId) => {
    const vehicle = vehicles.find(v => v.id === vehicleId);
    return vehicle ? vehicle.name : 'Unknown Vehicle';
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="trip-history-container">
      <div>
        <h2 className="text-3xl font-bold text-gray-900" style={{ fontFamily: 'Space Grotesk' }}>Trip History</h2>
        <p className="text-gray-500 mt-1">View and manage your trips</p>
      </div>

      {trips.length === 0 ? (
        <Card className="shadow-lg">
          <CardContent className="p-12 text-center">
            <History className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No Trips Yet</h3>
            <p className="text-gray-500">Start planning routes to create trips</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {trips.map((trip) => (
            <Card key={trip.id} className="shadow-lg hover:shadow-xl transition-shadow" data-testid={`trip-card-${trip.id}`}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <CardTitle className="flex items-center gap-2">
                      <Navigation className="w-5 h-5 text-purple-600" />
                      {getVehicleName(trip.vehicle_id)}
                    </CardTitle>
                    <CardDescription className="capitalize">
                      {trip.route_type} route
                    </CardDescription>
                  </div>
                  <Badge className={statusColors[trip.status]}>
                    {trip.status.replace('_', ' ')}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                      <MapPin className="w-4 h-4" />
                      <span>Start</span>
                    </div>
                    <p className="text-sm font-medium">
                      {trip.start_location.lat.toFixed(4)}, {trip.start_location.lng.toFixed(4)}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                      <MapPin className="w-4 h-4" />
                      <span>End</span>
                    </div>
                    <p className="text-sm font-medium">
                      {trip.end_location.lat.toFixed(4)}, {trip.end_location.lng.toFixed(4)}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                      <Navigation className="w-4 h-4" />
                      <span>Distance</span>
                    </div>
                    <p className="text-sm font-medium">{trip.distance} km</p>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                      <Clock className="w-4 h-4" />
                      <span>Duration</span>
                    </div>
                    <p className="text-sm font-medium">{Math.round(trip.duration)} min</p>
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <Calendar className="w-4 h-4" />
                    <span>{format(new Date(trip.created_at), 'MMM dd, yyyy HH:mm')}</span>
                  </div>

                  <div className="flex gap-2">
                    {trip.status === 'planned' && (
                      <Button
                        size="sm"
                        onClick={() => handleStartTrip(trip.id)}
                        className="gap-2"
                        data-testid={`start-trip-${trip.id}`}
                      >
                        <Play className="w-4 h-4" />
                        Start Trip
                      </Button>
                    )}
                    {trip.status === 'in_progress' && (
                      <Button
                        size="sm"
                        onClick={() => handleCompleteTrip(trip.id)}
                        className="gap-2 bg-green-600 hover:bg-green-700"
                        data-testid={`complete-trip-${trip.id}`}
                      >
                        <CheckCircle className="w-4 h-4" />
                        Complete Trip
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
