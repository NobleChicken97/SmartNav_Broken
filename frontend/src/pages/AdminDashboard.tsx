/**
 * AdminDashboard - Comprehensive admin panel for system management
 * Manage users, events, and locations
 */

import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { EventService } from '../services/eventService';
import { UserService } from '../services/user';
import { useAuthStore } from '../stores/authStore';
import { Event, User } from '../types';
import LoadingSpinner from '../components/LoadingSpinner';
import { getRoleBadgeColor } from '../utils/permissions';

type Tab = 'overview' | 'users' | 'events';

const AdminDashboard = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [users, setUsers] = useState<User[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [updatingRoleId, setUpdatingRoleId] = useState<string | null>(null);
  const [selectedOrganizer, setSelectedOrganizer] = useState<string>('all'); // Filter by organizer
  const [eventStatusFilter, setEventStatusFilter] = useState<'all' | 'upcoming' | 'ongoing' | 'completed' | 'canceled'>('all'); // Filter by event status
  const { user: currentUser } = useAuthStore();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [usersData, eventsData] = await Promise.all([
        UserService.getAllUsers(),
        EventService.getEvents({ limit: 100 })
      ]);
      
      // Guard against unexpected response structure
      if (Array.isArray(usersData)) {
        setUsers(usersData);
      } else {
        console.warn('Unexpected users data structure:', usersData);
        setUsers([]);
      }
      
      if (eventsData && Array.isArray(eventsData.events)) {
        setEvents(eventsData.events);
      } else {
        console.warn('Unexpected events data structure:', eventsData);
        setEvents([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
      setUsers([]); // Reset to empty arrays on error
      setEvents([]);
      console.error('Failed to load admin data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (userId === currentUser?._id) {
      alert('You cannot delete your own account!');
      return;
    }

    if (!confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
      return;
    }

    try {
      setDeletingId(userId);
      await UserService.deleteUser(userId);
      setUsers(users.filter(u => u._id !== userId));
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete user');
      console.error('Failed to delete user:', err);
    } finally {
      setDeletingId(null);
    }
  };

  const handleChangeRole = async (userId: string, newRole: 'student' | 'organizer' | 'admin') => {
    if (userId === currentUser?._id) {
      alert('You cannot change your own role!');
      return;
    }

    // Add confirmation dialog
    const user = users.find(u => u._id === userId);
    const confirmMessage = `Are you sure you want to change ${user?.name || 'this user'}'s role to ${newRole}?`;
    if (!confirm(confirmMessage)) {
      return;
    }

    try {
      setUpdatingRoleId(userId);
      const updatedUser = await UserService.changeUserRole(userId, newRole);
      setUsers(users.map(u => u._id === userId ? updatedUser : u));
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to change role');
      console.error('Failed to change role:', err);
    } finally {
      setUpdatingRoleId(null);
    }
  };

  const handleDeleteEvent = async (eventId: string) => {
    if (!confirm('Are you sure you want to delete this event? This action cannot be undone.')) {
      return;
    }

    try {
      setDeletingId(eventId);
      await EventService.deleteEvent(eventId);
      setEvents(events.filter(e => e._id !== eventId));
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete event');
      console.error('Failed to delete event:', err);
    } finally {
      setDeletingId(null);
    }
  };

  const handleCancelEvent = async (eventId: string) => {
    if (!confirm('Are you sure you want to cancel this event? Attendees will be notified.')) {
      return;
    }

    try {
      setDeletingId(eventId);
      const cancelledEvent = await EventService.cancelEvent(eventId);
      
      // Update the event in the list with the cancelled version
      setEvents(prevEvents => 
        prevEvents.map(e => e._id === eventId ? cancelledEvent : e)
      );
      
      // Show success message
      // alert('Event cancelled successfully');
    } catch (err) {
      console.error('Failed to cancel event:', err);
      alert(err instanceof Error ? err.message : 'Failed to cancel event');
    } finally {
      setDeletingId(null);
    }
  };

  const handleEditEvent = (eventId: string) => {
    navigate(`/events/${eventId}/edit`);
  };

  // Calculate statistics
  const totalUsers = users.length;
  const adminCount = users.filter(u => u.role === 'admin').length;
  const organizerCount = users.filter(u => u.role === 'organizer').length;
  const studentCount = users.filter(u => u.role === 'student').length;
  const totalEvents = events.length;
  
  // Exclude cancelled events from time-based status counts
  const upcomingEventsCount = events.filter(e => e.status !== 'cancelled' && EventService.getEventStatus(e) === 'upcoming').length;
  const ongoingEventsCount = events.filter(e => e.status !== 'cancelled' && EventService.getEventStatus(e) === 'ongoing').length;
  const completedEventsCount = events.filter(e => e.status !== 'cancelled' && EventService.getEventStatus(e) === 'completed').length;
  const canceledEventsCount = events.filter(e => e.status === 'cancelled').length;
  const totalRegistrations = events.reduce((sum, e) => sum + e.attendees.length, 0);

  // Get unique organizers from events
  const organizers = Array.from(new Set(events.map(e => e.organizer))).sort();

  // Filter events by selected organizer and status
  const filteredEvents = events.filter(event => {
    // Filter by organizer
    const matchesOrganizer = selectedOrganizer === 'all' || event.organizer === selectedOrganizer;
    
    // Filter by event status
    let matchesStatus = true;
    if (eventStatusFilter !== 'all') {
      if (eventStatusFilter === 'canceled') {
        matchesStatus = event.status === 'cancelled';
      } else {
        // For upcoming/ongoing/completed, exclude cancelled events
        const status = EventService.getEventStatus(event);
        matchesStatus = status === eventStatusFilter && event.status !== 'cancelled';
      }
    } else {
      // When showing 'all', exclude cancelled events (they have their own filter)
      matchesStatus = event.status !== 'cancelled';
    }
    
    return matchesOrganizer && matchesStatus;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
              <p className="mt-2 text-gray-600">
                System administration and management
              </p>
            </div>
            <Link
              to="/map"
              className="inline-flex items-center px-6 py-3 border border-gray-300 text-base font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
            >
              <svg className="mr-2 h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
              </svg>
              Go to Map
            </Link>
          </div>
        </div>

        {/* Error State */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex">
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              <div className="ml-3">
                <p className="text-sm text-red-800">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="mb-6">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8">
              <button
                onClick={() => setActiveTab('overview')}
                className={`${
                  activeTab === 'overview'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors`}
              >
                Overview
              </button>
              <button
                onClick={() => setActiveTab('users')}
                className={`${
                  activeTab === 'users'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors`}
              >
                Users ({totalUsers})
              </button>
              <button
                onClick={() => setActiveTab('events')}
                className={`${
                  activeTab === 'events'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors`}
              >
                Events ({totalEvents})
              </button>
            </nav>
          </div>
        </div>

        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              <div className="bg-white rounded-lg shadow-md p-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0 bg-blue-100 rounded-md p-3">
                    <svg className="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                    </svg>
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Total Users</p>
                    <p className="text-2xl font-bold text-gray-900">{totalUsers}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow-md p-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0 bg-green-100 rounded-md p-3">
                    <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Total Events</p>
                    <p className="text-2xl font-bold text-gray-900">{totalEvents}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow-md p-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0 bg-purple-100 rounded-md p-3">
                    <svg className="h-6 w-6 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Upcoming Events</p>
                    <p className="text-2xl font-bold text-gray-900">{upcomingEventsCount}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow-md p-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0 bg-yellow-100 rounded-md p-3">
                    <svg className="h-6 w-6 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Total Registrations</p>
                    <p className="text-2xl font-bold text-gray-900">{totalRegistrations}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Role Distribution */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">User Role Distribution</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-600">Administrators</span>
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                      Admin
                    </span>
                  </div>
                  <p className="text-3xl font-bold text-gray-900 mt-2">{adminCount}</p>
                </div>
                <div className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-600">Organizers</span>
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      Organizer
                    </span>
                  </div>
                  <p className="text-3xl font-bold text-gray-900 mt-2">{organizerCount}</p>
                </div>
                <div className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-600">Students</span>
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      Student
                    </span>
                  </div>
                  <p className="text-3xl font-bold text-gray-900 mt-2">{studentCount}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Users Tab */}
        {activeTab === 'users' && (
          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Joined</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {users.map(user => (
                    <tr key={user._id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-10 w-10 bg-gray-200 rounded-full flex items-center justify-center">
                            <span className="text-gray-600 font-medium text-sm">
                              {user.name.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900">{user.name}</div>
                            {user._id === currentUser?._id && (
                              <div className="text-xs text-blue-600">(You)</div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{user.email}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {updatingRoleId === user._id ? (
                          <div className="flex items-center">
                            <LoadingSpinner size="sm" />
                            <span className="ml-2 text-xs text-gray-500">Updating...</span>
                          </div>
                        ) : (
                          <select
                            value={user.role}
                            onChange={(e) => handleChangeRole(user._id, e.target.value as 'student' | 'organizer' | 'admin')}
                            disabled={user._id === currentUser?._id || updatingRoleId !== null}
                            className={`text-xs font-medium rounded-full px-2.5 py-0.5 ${getRoleBadgeColor(user.role)} disabled:opacity-50 disabled:cursor-not-allowed`}
                          >
                            <option value="student">Student</option>
                            <option value="organizer">Organizer</option>
                            <option value="admin">Admin</option>
                          </select>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(user.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button
                          onClick={() => handleDeleteUser(user._id)}
                          disabled={user._id === currentUser?._id || deletingId === user._id}
                          className="text-red-600 hover:text-red-900 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {deletingId === user._id ? 'Deleting...' : 'Delete'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Events Tab */}
        {activeTab === 'events' && (
          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            {/* Events Header with Filters and Create Button */}
            <div className="px-6 py-4 border-b border-gray-200">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-gray-900">All Events</h2>
                <Link
                  to="/events/create"
                  className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  <svg className="mr-2 h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Create Event
                </Link>
              </div>
              
              {/* Event Statistics Cards */}
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
                {/* Upcoming Events */}
                <button
                  onClick={() => setEventStatusFilter(eventStatusFilter === 'upcoming' ? 'all' : 'upcoming')}
                  className={`bg-blue-50 rounded-lg p-4 text-left transition-all hover:shadow-md ${
                    eventStatusFilter === 'upcoming' ? 'ring-2 ring-blue-500 shadow-md' : ''
                  }`}
                >
                  <div className="flex items-center">
                    <div className="flex-shrink-0 bg-blue-100 rounded-md p-2">
                      <svg className="h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div className="ml-3">
                      <p className="text-xs font-medium text-gray-600">Upcoming</p>
                      <p className="text-xl font-bold text-gray-900">{upcomingEventsCount}</p>
                    </div>
                  </div>
                </button>

                {/* Ongoing Events */}
                <button
                  onClick={() => setEventStatusFilter(eventStatusFilter === 'ongoing' ? 'all' : 'ongoing')}
                  className={`bg-purple-50 rounded-lg p-4 text-left transition-all hover:shadow-md ${
                    eventStatusFilter === 'ongoing' ? 'ring-2 ring-purple-500 shadow-md' : ''
                  }`}
                >
                  <div className="flex items-center">
                    <div className="flex-shrink-0 bg-purple-100 rounded-md p-2">
                      <svg className="h-5 w-5 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div className="ml-3">
                      <p className="text-xs font-medium text-gray-600">Ongoing</p>
                      <p className="text-xl font-bold text-gray-900">{ongoingEventsCount}</p>
                    </div>
                  </div>
                </button>

                {/* Completed Events */}
                <button
                  onClick={() => setEventStatusFilter(eventStatusFilter === 'completed' ? 'all' : 'completed')}
                  className={`bg-green-50 rounded-lg p-4 text-left transition-all hover:shadow-md ${
                    eventStatusFilter === 'completed' ? 'ring-2 ring-green-500 shadow-md' : ''
                  }`}
                >
                  <div className="flex items-center">
                    <div className="flex-shrink-0 bg-green-100 rounded-md p-2">
                      <svg className="h-5 w-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div className="ml-3">
                      <p className="text-xs font-medium text-gray-600">Completed</p>
                      <p className="text-xl font-bold text-gray-900">{completedEventsCount}</p>
                    </div>
                  </div>
                </button>

                {/* Canceled Events */}
                <button
                  onClick={() => setEventStatusFilter(eventStatusFilter === 'canceled' ? 'all' : 'canceled')}
                  className={`bg-red-50 rounded-lg p-4 text-left transition-all hover:shadow-md ${
                    eventStatusFilter === 'canceled' ? 'ring-2 ring-red-500 shadow-md' : ''
                  }`}
                >
                  <div className="flex items-center">
                    <div className="flex-shrink-0 bg-red-100 rounded-md p-2">
                      <svg className="h-5 w-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </div>
                    <div className="ml-3">
                      <p className="text-xs font-medium text-gray-600">Canceled</p>
                      <p className="text-xl font-bold text-gray-900">{canceledEventsCount}</p>
                    </div>
                  </div>
                </button>

                {/* Total Registrations */}
                <div className="bg-indigo-50 rounded-lg p-4">
                  <div className="flex items-center">
                    <div className="flex-shrink-0 bg-indigo-100 rounded-md p-2">
                      <svg className="h-5 w-5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                    </div>
                    <div className="ml-3">
                      <p className="text-xs font-medium text-gray-600">Registrations</p>
                      <p className="text-xl font-bold text-gray-900">{totalRegistrations}</p>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Organizer Filter */}
              <div className="flex items-center gap-3">
                <label htmlFor="organizer-filter" className="text-sm font-medium text-gray-700">
                  Filter by Organizer:
                </label>
                <select
                  id="organizer-filter"
                  value={selectedOrganizer}
                  onChange={(e) => setSelectedOrganizer(e.target.value)}
                  className="block px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm text-gray-900"
                >
                  <option value="all">All Organizers ({events.length})</option>
                  {organizers.map(organizer => {
                    const count = events.filter(e => e.organizer === organizer).length;
                    return (
                      <option key={organizer} value={organizer}>
                        {organizer} ({count})
                      </option>
                    );
                  })}
                </select>
                <span className="text-sm text-gray-500">
                  Showing {filteredEvents.length} of {events.length} events
                </span>
              </div>
            </div>

            <div className="divide-y divide-gray-200">
              {filteredEvents.length === 0 ? (
                <div className="text-center py-12">
                  <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <h3 className="mt-2 text-sm font-medium text-gray-900">
                    {selectedOrganizer === 'all' ? 'No events yet' : `No events by ${selectedOrganizer}`}
                  </h3>
                  <p className="mt-1 text-sm text-gray-500">
                    {selectedOrganizer === 'all' 
                      ? 'Get started by creating the first event.'
                      : 'Try selecting a different organizer or create a new event.'}
                  </p>
                </div>
              ) : (
                filteredEvents.map(event => {
                  const { date, timeRange } = EventService.formatEventDateTime(event);
                  const status = EventService.getEventStatus(event);

                  return (
                    <div key={event._id} className="p-6 hover:bg-gray-50">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="text-lg font-semibold text-gray-900">{event.title}</h3>
                            
                            {/* Event Status Badge */}
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              event.status === 'published' ? 'bg-green-100 text-green-800' :
                              event.status === 'draft' ? 'bg-yellow-100 text-yellow-800' :
                              'bg-red-100 text-red-800'
                            }`}>
                              {event.status.charAt(0).toUpperCase() + event.status.slice(1)}
                            </span>
                            
                            {/* Time-based Status Badge - only show for non-cancelled events */}
                            {event.status !== 'cancelled' && (
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                status === 'upcoming' ? 'bg-blue-100 text-blue-800' :
                                status === 'ongoing' ? 'bg-purple-100 text-purple-800' :
                                'bg-gray-100 text-gray-800'
                              }`}>
                                {status.charAt(0).toUpperCase() + status.slice(1)}
                              </span>
                            )}
                            
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                              {event.category}
                            </span>
                          </div>
                          <p className="text-sm text-gray-600 mb-2">{event.description}</p>
                          <div className="flex flex-wrap gap-4 text-sm text-gray-500">
                            <span>📅 {date}</span>
                            <span>🕐 {timeRange}</span>
                            <span>👥 {event.attendees.length}/{event.capacity}</span>
                            <span>👤 By: {event.organizer}</span>
                          </div>
                        </div>
                        
                        {/* Action Buttons */}
                        <div className="ml-6 flex items-center gap-2">
                          <button
                            onClick={() => handleEditEvent(event._id)}
                            className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
                            title="Edit event"
                          >
                            <svg className="h-4 w-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                            Edit
                          </button>
                          
                          {/* Cancel button - only for upcoming events that aren't already cancelled */}
                          {status === 'upcoming' && event.status !== 'cancelled' && (
                            <button
                              onClick={() => handleCancelEvent(event._id)}
                              disabled={deletingId === event._id}
                              className="inline-flex items-center px-3 py-2 border border-orange-300 shadow-sm text-sm leading-4 font-medium rounded-md text-orange-700 bg-white hover:bg-orange-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                              title="Cancel event"
                            >
                              {deletingId === event._id ? (
                                <LoadingSpinner size="sm" />
                              ) : (
                                <>
                                  <svg className="h-4 w-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                  </svg>
                                  Cancel
                                </>
                              )}
                            </button>
                          )}
                          
                          <button
                            onClick={() => handleDeleteEvent(event._id)}
                            disabled={deletingId === event._id}
                            className="inline-flex items-center px-3 py-2 border border-red-300 shadow-sm text-sm leading-4 font-medium rounded-md text-red-700 bg-white hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            title="Delete event"
                          >
                            {deletingId === event._id ? (
                              <LoadingSpinner size="sm" />
                            ) : (
                              <>
                                <svg className="h-4 w-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                                Delete
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminDashboard;
