import { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LogOut, Plus, Truck as TruckIcon, MapIcon, History, CreditCard } from 'lucide-react';
import FleetMap from '@/components/FleetMap';
import VehicleManagement from '@/components/VehicleManagement';
import RoutePlanner from '@/components/RoutePlanner';
import TripHistory from '@/components/TripHistory';
import FASTagPayments from '@/components/FASTagPayments';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function Dashboard({ token, setToken }) {
  const [user, setUser] = useState(null);
  const [vehicles, setVehicles] = useState([]);
  const [activeTab, setActiveTab] = useState('map');

  useEffect(() => {
    fetchUser();
    fetchVehicles();
  }, []);

  const fetchUser = async () => {
    try {
      const response = await axios.get(`${API}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUser(response.data);
    } catch (error) {
      toast.error('Failed to fetch user data');
      setToken(null);
    }
  };

  const fetchVehicles = async () => {
    try {
      const response = await axios.get(`${API}/vehicles`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setVehicles(response.data);
    } catch (error) {
      toast.error('Failed to fetch vehicles');
    }
  };

  const handleLogout = () => {
    setToken(null);
    toast.success('Logged out successfully');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-lg border-b border-gray-200 sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-600 to-indigo-600 flex items-center justify-center shadow-lg">
                <TruckIcon className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900" style={{ fontFamily: 'Space Grotesk' }} data-testid="dashboard-title">FleetWise</h1>
                <p className="text-xs text-gray-500">Smart Fleet Manager</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-medium text-gray-900" data-testid="user-name">{user?.name}</p>
                <p className="text-xs text-gray-500">{user?.email}</p>
              </div>
              <Button 
                onClick={handleLogout} 
                variant="outline"
                className="gap-2"
                data-testid="logout-button"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline">Logout</span>
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid grid-cols-2 md:grid-cols-5 gap-2 bg-white/80 backdrop-blur-sm p-2 rounded-xl shadow-lg">
            <TabsTrigger value="map" className="gap-2" data-testid="map-tab">
              <MapIcon className="w-4 h-4" />
              <span className="hidden sm:inline">Live Map</span>
              <span className="sm:hidden">Map</span>
            </TabsTrigger>
            <TabsTrigger value="vehicles" className="gap-2" data-testid="vehicles-tab">
              <TruckIcon className="w-4 h-4" />
              <span className="hidden sm:inline">Vehicles</span>
              <span className="sm:hidden">Fleet</span>
            </TabsTrigger>
            <TabsTrigger value="routes" className="gap-2" data-testid="routes-tab">
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Plan Route</span>
              <span className="sm:hidden">Route</span>
            </TabsTrigger>
            <TabsTrigger value="trips" className="gap-2" data-testid="trips-tab">
              <History className="w-4 h-4" />
              <span className="hidden sm:inline">Trip History</span>
              <span className="sm:hidden">Trips</span>
            </TabsTrigger>
            <TabsTrigger value="fastag" className="gap-2" data-testid="fastag-tab">
              <CreditCard className="w-4 h-4" />
              <span className="hidden sm:inline">FASTag</span>
              <span className="sm:hidden">Tolls</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="map" className="space-y-4">
            <FleetMap token={token} vehicles={vehicles} />
          </TabsContent>

          <TabsContent value="vehicles" className="space-y-4">
            <VehicleManagement token={token} vehicles={vehicles} fetchVehicles={fetchVehicles} />
          </TabsContent>

          <TabsContent value="routes" className="space-y-4">
            <RoutePlanner token={token} vehicles={vehicles} />
          </TabsContent>

          <TabsContent value="trips" className="space-y-4">
            <TripHistory token={token} vehicles={vehicles} />
          </TabsContent>

          <TabsContent value="fastag" className="space-y-4">
            <FASTagPayments token={token} vehicles={vehicles} />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
