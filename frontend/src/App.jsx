import { useEffect, useState } from 'react';
import AuthPage from './AuthPage';
import AdminDashboard from './AdminDashboard';
import TransportPage from './TransportPage';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import heroImage from './assets/hero.png';
import safariHeroImage from './assets/safari-hero.jpg';
import './App.css';

// ADDED: Override this through VITE_API_BASE_URL when deploying.
const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:5000/api';

// CHANGED: Safari Planner homepage with a connected trip-planning form.
function Icon({ name, size = 20 }) {
  const paths = {
    compass: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="m15.5 8.5-2.2 4.8-4.8 2.2 2.2-4.8 4.8-2.2Z" />
      </>
    ),
    arrow: <path d="M7 17 17 7M7 7h10v10" />,
    pin: (
      <>
        <path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" />
        <circle cx="12" cy="10" r="2.5" />
      </>
    ),
    calendar: (
      <>
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <path d="M16 3v4M8 3v4M3 10h18" />
      </>
    ),
    leaf: (
      <>
        <path d="M20 4C10 4 4 8 4 15a5 5 0 0 0 5 5c7 0 11-7 11-16Z" />
        <path d="M4 20c3-5 7-8 12-11" />
      </>
    ),
    arrowRight: <path d="M5 12h14m-6-6 6 6-6 6" />,
    menu: <path d="M4 7h16M4 12h16M4 17h16" />,
    close: <path d="m6 6 12 12M18 6 6 18" />,
  };

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  );
}

function App() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(
    () => localStorage.getItem('safari_planner_theme') === 'dark'
  );

  useEffect(() => {
    document.documentElement.dataset.theme = darkMode ? 'dark' : 'light';
    localStorage.setItem('safari_planner_theme', darkMode ? 'dark' : 'light');
  }, [darkMode]);

  const [authToken, setAuthToken] = useState(
    () => sessionStorage.getItem('safari_planner_token') || ''
  );
  const [currentUser, setCurrentUser] = useState(null);
  const [authChecking, setAuthChecking] = useState(
    () => Boolean(sessionStorage.getItem('safari_planner_token'))
  );
  const [authMode, setAuthMode] = useState('login');
  const [authForm, setAuthForm] = useState({
    full_name: '',
    email: '',
    password: '',
  });
  const [authSubmitting, setAuthSubmitting] = useState(false);
  const [authError, setAuthError] = useState('');

  // ADDED: Destination data and API loading states.
  const [destinations, setDestinations] = useState([]);
  const [destinationsLoading, setDestinationsLoading] = useState(true);
  const [destinationsError, setDestinationsError] = useState('');
  const [destinationSearch, setDestinationSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [recommendationStyle, setRecommendationStyle] = useState('Wildlife & Safari');
  const [recommendationInterests, setRecommendationInterests] = useState('');
  const [recommendationBudget, setRecommendationBudget] = useState('');
  const [recommendationDays, setRecommendationDays] = useState('3');
  const [recommendations, setRecommendations] = useState([]);
  const [recommendationsLoading, setRecommendationsLoading] = useState(false);
  const [recommendationsError, setRecommendationsError] = useState('');
  const [accommodations, setAccommodations] = useState([]);
  const [accommodationsLoading, setAccommodationsLoading] = useState(false);
  const [accommodationsError, setAccommodationsError] = useState('');



  const destinationCategories = [
    ...new Set(
      destinations
        .map((destination) => destination.category)
        .filter(Boolean)
    ),
  ].sort();

  const filteredDestinations = destinations.filter((destination) => {
    const searchText = destinationSearch.trim().toLowerCase();

    const matchesSearch = [
      destination.name,
      destination.region,
      destination.country,
      destination.description,
    ]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(searchText));

    const matchesCategory =
      selectedCategory === 'All' ||
      destination.category === selectedCategory;

    return matchesSearch && matchesCategory;
  });

  const [savedItineraries, setSavedItineraries] = useState([]);
  const [savedItinerariesLoading, setSavedItinerariesLoading] = useState(true);
  const [savedItinerariesError, setSavedItinerariesError] = useState("");
  const [tripSearch, setTripSearch] = useState("");
  const [tripFilter, setTripFilter] = useState("all");

  useEffect(() => {
    let cancelled = false;

    async function loadDestinations() {
      try {
        const response = await fetch(`${API_BASE_URL}/destinations`);
        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || 'Unable to load destinations.');
        }

        if (!cancelled) {
          setDestinations(
            Array.isArray(result.destinations) ? result.destinations : [],
          );
        }
      } catch (error) {
        if (!cancelled) {
          setDestinationsError(
            error.message === 'Failed to fetch'
              ? 'Could not load destinations. Check that the Flask server is running.'
              : error.message || 'Unable to load destinations.',
          );
        }
      } finally {
        if (!cancelled) {
          setDestinationsLoading(false);
        }
      }
    }

    loadDestinations();

    return () => {
      cancelled = true;
    };
  }, []);


  const [trip, setTrip] = useState({
    destination: '',
    startDate: '',
    endDate: '',
    travelStyle: 'Wildlife & Safari',
    budget: '',
  });

  // ADDED: Track API submission state and the response from Flask.
  const [isSaving, setIsSaving] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [savedPreference, setSavedPreference] = useState(null);
  const [guestAccessToken, setGuestAccessToken] = useState(
    () => sessionStorage.getItem("safari_planner_guest_access_token") || ""
  );
  const [generatedItinerary, setGeneratedItinerary] = useState(null);
  const [selectedItinerary, setSelectedItinerary] = useState(null);
  const [selectedItineraryLoading, setSelectedItineraryLoading] = useState(false);
  const [selectedItineraryError, setSelectedItineraryError] = useState("");
  const [deletingItineraryId, setDeletingItineraryId] = useState(null);
  const [deleteItineraryError, setDeleteItineraryError] = useState("");

  const [isEditingTrip, setIsEditingTrip] = useState(false);
  const [isUpdatingTrip, setIsUpdatingTrip] = useState(false);
  const [editTripError, setEditTripError] = useState("");
  const [editTripSuccess, setEditTripSuccess] = useState("");
  const [editTrip, setEditTrip] = useState({
    destination: "",
    startDate: "",
    endDate: "",
    travelStyle: "Wildlife & Safari",
    budget: "",
  });

  useEffect(() => {
    let cancelled = false;

    async function loadSavedItineraries() {
      if (authChecking) return;

      if (!authToken || !currentUser) {
        setSavedItineraries([]);
        setSavedItinerariesError('');
        setSavedItinerariesLoading(false);
        return;
      }

      setSavedItinerariesLoading(true);
      setSavedItinerariesError('');

      try {
        const response = await fetch(`${API_BASE_URL}/itineraries`, {
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
        });
        const result = await response.json();

        if (!response.ok) {
          throw new Error(
            result.error || 'Unable to load saved itineraries.'
          );
        }

        if (!cancelled) {
          setSavedItineraries(
            Array.isArray(result.itineraries) ? result.itineraries : []
          );
        }
      } catch (err) {
        if (!cancelled) {
          setSavedItinerariesError(
            err.message === 'Failed to fetch'
              ? 'Saved trips are temporarily unavailable. Please try again later.'
              : err.message || 'Unable to load saved itineraries.'
          );
        }
      } finally {
        if (!cancelled) {
          setSavedItinerariesLoading(false);
        }
      }
    }

    loadSavedItineraries();

    return () => {
      cancelled = true;
    };
  }, [authToken, currentUser, authChecking]);

  function openSavedItinerary(itineraryId) {
    navigate(`/my-trips/${itineraryId}`);
  }

  async function deleteSavedItinerary(itineraryId) {
    const confirmed = window.confirm(
      "Are you sure you want to delete this saved itinerary? This cannot be undone."
    );

    if (!confirmed) {
      return;
    }

    setDeletingItineraryId(itineraryId);
    setDeleteItineraryError("");

    try {
      const response = await fetch(
        `${API_BASE_URL}/itineraries/${itineraryId}`,
        { method: "DELETE", headers: getAuthHeaders() }
      );
      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error || "Unable to delete this saved itinerary."
        );
      }

      setSavedItineraries((previous) =>
        previous.filter((item) => item.itinerary_id !== itineraryId)
      );

      if (selectedItinerary?.itinerary_id === itineraryId) {
        setSelectedItinerary(null);
      }
    } catch (err) {
      setDeleteItineraryError(
        err.message === "Failed to fetch"
          ? "The itinerary service is unavailable. Please try again."
          : err.message || "Unable to delete this saved itinerary."
      );
    } finally {
      setDeletingItineraryId(null);
    }
  }

  function beginEditingTrip() {
    const plan = selectedItinerary?.plan;

    if (!plan) return;

    setEditTrip({
      destination: plan.destination || "",
      startDate: plan.start_date || "",
      endDate: plan.end_date || "",
      travelStyle: plan.travel_style || "Wildlife & Safari",
      budget: plan.budget_kes == null ? "" : String(plan.budget_kes),
    });

    setEditTripError("");
    setEditTripSuccess("");
    setIsEditingTrip(true);
  }

  function updateEditTrip(event) {
    const { name, value } = event.target;

    setEditTrip((previous) => ({
      ...previous,
      [name]: value,
    }));

    setEditTripError("");
    setEditTripSuccess("");
  }

  async function submitEditTrip(event) {
    event.preventDefault();

    if (!selectedItinerary?.trip_preference_id) {
      setEditTripError(
        "The original trip preferences could not be identified."
      );
      return;
    }

    if (editTrip.endDate < editTrip.startDate) {
      setEditTripError("The end date cannot be before the start date.");
      return;
    }

    setIsUpdatingTrip(true);
    setEditTripError("");
    setEditTripSuccess("");

    try {
      const response = await fetch(
        `${API_BASE_URL}/trip-preferences/${selectedItinerary.trip_preference_id}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            ...getAuthHeaders(),
            ...(guestAccessToken
              ? { "X-Guest-Access-Token": guestAccessToken }
              : {}),
          },
          body: JSON.stringify({
            destination: editTrip.destination.trim(),
            start_date: editTrip.startDate,
            end_date: editTrip.endDate,
            travel_style: editTrip.travelStyle,
            budget:
              editTrip.budget.trim() === ""
                ? null
                : Number(editTrip.budget),
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Unable to update this trip.");
      }

      // Retrieve the regenerated itinerary.
      const detailResponse = await fetch(
        `${API_BASE_URL}/itineraries/${selectedItinerary.itinerary_id}`,
        { headers: getAuthHeaders() }
      );
      const detailResult = await detailResponse.json();

      if (!detailResponse.ok) {
        throw new Error(
          detailResult.error || "Trip updated, but the itinerary could not be refreshed."
        );
      }

      setSelectedItinerary(detailResult);
      setIsEditingTrip(false);
      setEditTripSuccess("Your trip and itinerary have been updated.");

      // Refresh the saved-trip cards without undoing a successful update
      // if the list request temporarily fails.
      try {
        const listResponse = await fetch(`${API_BASE_URL}/itineraries`, {
          headers: getAuthHeaders(),
        });
        const listResult = await listResponse.json();

        if (listResponse.ok) {
          setSavedItineraries(
            Array.isArray(listResult.itineraries)
              ? listResult.itineraries
              : []
          );
        }
      } catch {
        // The refreshed detail remains available even if this request fails.
      }
    } catch (err) {
      setEditTripError(
        err.message === "Failed to fetch"
          ? "Could not reach Safari Planner. Check that the Flask server is running."
          : err.message || "Unable to update this trip."
      );
    } finally {
      setIsUpdatingTrip(false);
    }
  }

  const updateTrip = (event) => {
    const { name, value } = event.target;

    setTrip((previous) => ({
      ...previous,
      [name]: value,
    }));

    // ADDED: Clear outdated feedback when the form changes.
    setSubmitted(false);
    setError('');
    setSavedPreference(null);
    setGeneratedItinerary(null);
  };

  const scrollToPlanner = () => {
    document.getElementById('plan-trip')?.scrollIntoView({
      behavior: 'smooth',
    });
    setMobileOpen(false);
  };

  // CHANGED: Submit the form to the Flask API instead of showing a preview.
  const submitTrip = async (event) => {
    event.preventDefault();

    if (trip.endDate < trip.startDate) {
      setError("The end date cannot be before the start date.");
      return;
    }

    setIsSaving(true);
    setSubmitted(false);
    setError("");
    setSavedPreference(null);
    setGeneratedItinerary(null);
    setGuestAccessToken("");
    sessionStorage.removeItem("safari_planner_guest_access_token");

    let preferencesSaved = false;

    try {
      const response = await fetch(`${API_BASE_URL}/trip-preferences`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          destination: trip.destination.trim(),
          start_date: trip.startDate,
          end_date: trip.endDate,
          travel_style: trip.travelStyle,
          budget: trip.budget === "" ? null : Number(trip.budget),
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error || "Unable to save your trip preferences."
        );
      }

      preferencesSaved = true;
      setSavedPreference(result.preference);

      const newGuestAccessToken = result.guest_access_token || "";
      setGuestAccessToken(newGuestAccessToken);

      if (newGuestAccessToken) {
        sessionStorage.setItem(
          "safari_planner_guest_access_token",
          newGuestAccessToken
        );
      }

      // Generate the itinerary using the guest token or user JWT.
      const itineraryResponse = await fetch(
        `${API_BASE_URL}/trip-preferences/${result.preference.id}/generate`,
        {
          method: "POST",
          headers: {
            ...getAuthHeaders(),
            ...(newGuestAccessToken
              ? { "X-Guest-Access-Token": newGuestAccessToken }
              : {}),
          },
        }
      );

      const itineraryResult = await itineraryResponse.json();

      if (!itineraryResponse.ok) {
        throw new Error(
          itineraryResult.error || "Unable to generate your itinerary."
        );
      }

      setGeneratedItinerary(itineraryResult);
      setSubmitted(true);
    } catch (err) {
      const message =
        err.message === "Failed to fetch"
          ? "Could not reach Safari Planner. Check that Flask is running on port 5000."
          : err.message || "Something went wrong. Please try again.";

      setError(
        preferencesSaved
          ? `Your preferences were saved, but itinerary generation failed: ${message}`
          : message
      );
    } finally {
      setIsSaving(false);
    }
  };


  const { pathname } = useLocation();
  const navigate = useNavigate();
  const destinationId = pathname.split("/")[2];

  function getAuthHeaders() {
    return authToken
      ? { Authorization: `Bearer ${authToken}` }
      : {};
  }

  useEffect(() => {
    let cancelled = false;

    async function validateSession() {
      if (!authToken) {
        setCurrentUser(null);
        setAuthChecking(false);
        return;
      }

      setAuthChecking(true);

      try {
        const response = await fetch(`${API_BASE_URL}/auth/me`, {
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
        });
        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || 'Your session has expired.');
        }

        if (!cancelled) {
          setCurrentUser(result.user);
        }
      } catch {
        if (!cancelled) {
          sessionStorage.removeItem('safari_planner_token');
          setAuthToken('');
          setCurrentUser(null);
        }
      } finally {
        if (!cancelled) {
          setAuthChecking(false);
        }
      }
    }

    validateSession();

    return () => {
      cancelled = true;
    };
  }, [authToken]);

  useEffect(() => {
    if (pathname === '/register') {
      setAuthMode('register');
    } else if (pathname === '/login') {
      setAuthMode('login');
    }
  }, [pathname]);

  async function submitAuthentication(event) {
    event.preventDefault();
    setAuthSubmitting(true);
    setAuthError('');

    const endpoint = authMode === 'register' ? 'register' : 'login';

    try {
      const payload = authMode === 'register'
        ? authForm
        : { email: authForm.email, password: authForm.password };

      const response = await fetch(`${API_BASE_URL}/auth/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Authentication failed. Please try again.');
      }

      sessionStorage.setItem('safari_planner_token', result.access_token);
      setAuthToken(result.access_token);
      setCurrentUser(result.user);
      setAuthForm({ full_name: '', email: '', password: '' });
      navigate(result.user?.role === 'admin' ? '/admin' : '/my-trips');
    } catch (err) {
      setAuthError(
        err.message === 'Failed to fetch'
          ? 'Could not connect to Safari Planner. Check that the Flask server is running.'
          : err.message || 'Authentication failed. Please try again.'
      );
    } finally {
      setAuthSubmitting(false);
    }
  }

  async function logout() {
    const token = authToken;

    try {
      if (token) {
        await fetch(`${API_BASE_URL}/auth/logout`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        });
      }
    } finally {
      sessionStorage.removeItem('safari_planner_token');
      setAuthToken('');
      setCurrentUser(null);
      setSavedItineraries([]);
      setSelectedItinerary(null);
      setSelectedItineraryError('');
      setSavedItinerariesError('');
      navigate('/');
    }
  }

  const isHomePage = pathname === "/";
  const isExplorePage = pathname === "/explore";
  const isTransportPage = pathname === "/transport";
  const isPlannerPage = pathname === "/plan-trip";
  const isMyTripsPage =
    pathname === "/my-trips" || pathname.startsWith("/my-trips/");
  const isItineraryDetailPage =
    /^\/my-trips\/\d+$/.test(pathname);
  const isAuthPage =
    pathname === "/login" || pathname === "/register";
  const isDestinationPage = pathname.startsWith("/destinations/");

  // Load a saved itinerary when its detail URL is opened directly.
  useEffect(() => {
    let cancelled = false;

    async function loadSelectedItinerary() {
      if (!isItineraryDetailPage) {
        setSelectedItinerary(null);
        setSelectedItineraryError("");
        setSelectedItineraryLoading(false);
        return;
      }

      if (authChecking) return;

      if (!authToken || !currentUser) {
        setSelectedItinerary(null);
        setSelectedItineraryError("Please sign in to view this saved itinerary.");
        setSelectedItineraryLoading(false);
        return;
      }

      setSelectedItinerary(null);
      setSelectedItineraryError("");
      setSelectedItineraryLoading(true);

      try {
        const response = await fetch(
          `${API_BASE_URL}/itineraries/${destinationId}`,
          { headers: getAuthHeaders() }
        );
        const result = await response.json();

        if (!response.ok) {
          throw new Error(
            result.error || "Unable to load this saved itinerary."
          );
        }

        if (!cancelled) {
          setSelectedItinerary(result);
        }
      } catch (err) {
        if (!cancelled) {
          setSelectedItineraryError(
            err.message === "Failed to fetch"
              ? "Could not reach Safari Planner. Check that the Flask server is running."
              : err.message || "Unable to load this saved itinerary."
          );
        }
      } finally {
        if (!cancelled) {
          setSelectedItineraryLoading(false);
        }
      }
    }

    loadSelectedItinerary();

    return () => {
      cancelled = true;
    };
  }, [
    pathname,
    isItineraryDetailPage,
    destinationId,
    authToken,
    currentUser,
    authChecking,
  ]);

  const currentDestination = destinations.find(
    (destination) => String(destination.id) === String(destinationId)
  );

  useEffect(() => {
    let cancelled = false;

    async function loadAccommodations() {
      if (!isDestinationPage || !currentDestination?.id) {
        setAccommodations([]);
        setAccommodationsError('');
        setAccommodationsLoading(false);
        return;
      }

      setAccommodationsLoading(true);
      setAccommodationsError('');

      try {
        const response = await fetch(
          `${API_BASE_URL}/accommodations?destination_id=${currentDestination.id}`
        );
        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || 'Unable to load accommodation options.');
        }

        if (!cancelled) {
          setAccommodations(
            Array.isArray(result.accommodations) ? result.accommodations : []
          );
        }
      } catch (error) {
        if (!cancelled) {
          setAccommodationsError(
            error.message || 'Unable to load accommodation options.'
          );
        }
      } finally {
        if (!cancelled) setAccommodationsLoading(false);
      }
    }

    loadAccommodations();

    return () => {
      cancelled = true;
    };
  }, [isDestinationPage, currentDestination?.id]);


  const now = new Date();
  const today = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("-");

  const getTripStatus = (itinerary) => {
    if (!itinerary.start_date || !itinerary.end_date) return "pending";
    if (itinerary.end_date < today) return "past";
    if (itinerary.start_date > today) return "upcoming";
    return "ongoing";
  };

  const upcomingTrips = savedItineraries.filter(
    (trip) => getTripStatus(trip) === "upcoming"
  ).length;

  const ongoingTrips = savedItineraries.filter(
    (trip) => getTripStatus(trip) === "ongoing"
  ).length;

  const pastTrips = savedItineraries.filter(
    (trip) => getTripStatus(trip) === "past"
  ).length;

  const filteredSavedItineraries = savedItineraries.filter((itinerary) => {
    const query = tripSearch.trim().toLowerCase();
    const matchesSearch = [
      itinerary.destination,
      itinerary.destination_details?.region,
      itinerary.destination_details?.country,
      itinerary.travel_style,
    ]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(query));

    const status = getTripStatus(itinerary);
    const matchesFilter = tripFilter === "all" || status === tripFilter;

    return matchesSearch && matchesFilter;
  });

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
    setMobileOpen(false);
  }, [pathname]);

  if (pathname.startsWith('/admin')) {
    if (authChecking) {
      return <main className="admin-access-message">Checking administrator access...</main>;
    }

    if (!currentUser || !authToken) {
      return (
        <main className="admin-access-message">
          <h1>Administrator sign in required</h1>
          <p>Please sign in with your administrator account to continue.</p>
          <button type="button" onClick={() => navigate('/login')}>Go to sign in</button>
        </main>
      );
    }

    if (currentUser.role !== 'admin') {
      return (
        <main className="admin-access-message">
          <h1>Access restricted</h1>
          <p>This area is available to administrators only.</p>
          <button type="button" onClick={() => navigate('/')}>Return to Safari Planner</button>
        </main>
      );
    }

    return (
      <AdminDashboard
        token={authToken}
        apiBaseUrl={API_BASE_URL}
        onLogout={logout}
      />
    );
  }

  return (
    <>
      <header className="site-header">
        <Link className="brand" to="/" aria-label="Safari Planner home">
          <span className="brand__mark">
            <Icon name="compass" size={25} />
          </span>
          <span className="brand__name">
            safari<span>planner</span>
            <small>YOUR JOURNEY, CURATED</small>
          </span>
        </Link>

        <button
          className="mobile-toggle"
          aria-label={mobileOpen ? 'Close navigation' : 'Open navigation'}
          aria-expanded={mobileOpen}
          onClick={() => setMobileOpen(!mobileOpen)}
        >
          <Icon name={mobileOpen ? 'close' : 'menu'} size={24} />
        </button>

        <nav className={`main-nav ${mobileOpen ? 'main-nav--open' : ''}`}>
          <Link to="/" onClick={() => setMobileOpen(false)}>Home</Link>
          <Link to="/explore" onClick={() => setMobileOpen(false)}>Explore</Link>
          <Link to="/transport" onClick={() => setMobileOpen(false)}>Transport</Link>
          <Link to="/plan-trip" onClick={() => setMobileOpen(false)}>Plan a trip</Link>
          <Link to="/my-trips" onClick={() => setMobileOpen(false)}>My trips</Link>
          {currentUser ? (
            <>
              <span className="nav-user">
                Traveler
              </span>
              <button
                className="nav-auth-button"
                type="button"
                onClick={() => {
                  setMobileOpen(false);
                  logout();
                }}
              >
                Sign out
              </button>
            </>
          ) : (
            <Link to="/login" onClick={() => setMobileOpen(false)}>
              Sign in
            </Link>
          )}
          <button
            className="nav-theme-toggle"
            type="button"
            onClick={() => setDarkMode((current) => !current)}
            aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
            title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            <span aria-hidden="true">{darkMode ? '☀' : '☾'}</span>
            {darkMode ? 'Light mode' : 'Dark mode'}
          </button>
          <Link className="nav-cta" to="/plan-trip" onClick={() => setMobileOpen(false)}>
            Start planning <Icon name="arrow" size={16} />
          </Link>
        </nav>
      </header>

      <main className={`app-main ${
        isHomePage ? "app-main--home" :
        isExplorePage ? "app-main--explore" :
        isPlannerPage ? "app-main--planner" :
        isTransportPage ? "app-main--transport" :
        isMyTripsPage ? "app-main--my-trips" :
        isDestinationPage ? "app-main--destination" : "app-main--not-found"
      }`}>
        {isAuthPage ? (
          authChecking ? (
            <section className="auth-page section-shell">
              <p role="status">Checking your session...</p>
            </section>
          ) : (
            <AuthPage
              mode={authMode}
              setMode={(mode) => {
                setAuthMode(mode);
                setAuthError('');
                navigate(mode === 'register' ? '/register' : '/login');
              }}
              form={authForm}
              setForm={setAuthForm}
              onSubmit={submitAuthentication}
              loading={authSubmitting}
              error={authError}
            />
          )
        ) : (
          <>
            {isTransportPage ? (
              <TransportPage />
            ) : (
              <>
        {isDestinationPage && (
          <section className="destination-detail section-shell">
            <Link className="text-link destination-detail__back" to="/explore">
              <Icon name="arrowLeft" size={17} /> Back to destinations
            </Link>

            {currentDestination ? (
              <>
                <div className="destination-detail__hero">
                  <img
                    src={currentDestination.image_url || heroImage}
                    alt={currentDestination.name}
                    onError={(event) => {
                      event.currentTarget.onerror = null;
                      event.currentTarget.src = heroImage;
                    }}
                  />
                  <div className="destination-detail__hero-overlay" />
                  <div className="destination-detail__hero-caption">
                    <span>DISCOVER KENYA</span>
                    <p>{currentDestination.category || "A PLACE TO DISCOVER"}</p>
                  </div>
                </div>

                <div className="destination-detail__layout">
                  <div className="destination-detail__content">
                    <span className="eyebrow">
                      <span className="eyebrow__line" />
                      YOUR NEXT DESTINATION
                    </span>

                    <h1>{currentDestination.name}</h1>

                    <p className="destination-detail__location">
                      <Icon name="pin" size={16} />
                      {[currentDestination.region, currentDestination.country]
                        .filter(Boolean)
                        .join(", ")}
                    </p>

                    <p className="destination-detail__description">
                      {currentDestination.description ||
                        `Discover ${currentDestination.name} and make it part of a journey designed around your interests.`}
                    </p>

                    <button
                      className="button button--dark"
                      onClick={() => {
                        setTrip((previous) => ({
                          ...previous,
                          destination: currentDestination.name,
                        }));
                        navigate("/plan-trip");
                      }}
                    >
                      Plan a trip here <Icon name="arrow" size={17} />
                    </button>
                  </div>

                  <aside className="destination-detail__aside">
                    <span className="eyebrow">
                      <span className="eyebrow__line" />
                      AT A GLANCE
                    </span>

                    <div className="destination-detail__fact">
                      <span>DESTINATION</span>
                      <strong>{currentDestination.name}</strong>
                    </div>

                    <div className="destination-detail__fact">
                      <span>REGION</span>
                      <strong>{currentDestination.region || "Kenya"}</strong>
                    </div>

                    <div className="destination-detail__fact">
                      <span>COUNTRY</span>
                      <strong>{currentDestination.country || "Kenya"}</strong>
                    </div>

                    <div className="destination-detail__fact">
                      <span>EXPERIENCE</span>
                      <strong>{currentDestination.category || "Travel & discovery"}</strong>
                    </div>

                    <p className="destination-detail__aside-note">
                      Every journey is different. Build an itinerary around
                      your dates, budget and preferred travel style.
                    </p>
                  </aside>
                </div>

                <section className="destination-accommodations">
                  <div className="destination-accommodations__heading">
                    <span className="eyebrow">
                      <span className="eyebrow__line" />
                      WHERE TO STAY
                    </span>
                    <h2>Find your <em>place to stay.</em></h2>
                    <p>
                      Explore accommodation options around {currentDestination.name}.
                    </p>
                  </div>

                  {accommodationsLoading && (
                    <p className="destination-status">
                      Loading accommodation options...
                    </p>
                  )}

                  {accommodationsError && (
                    <p className="destination-status" role="alert">
                      {accommodationsError}
                    </p>
                  )}

                  {!accommodationsLoading &&
                    !accommodationsError &&
                    accommodations.length === 0 && (
                      <p className="destination-status">
                        No accommodation listings are available for this destination yet.
                      </p>
                    )}

                  {!accommodationsLoading &&
                    !accommodationsError &&
                    accommodations.length > 0 && (
                      <div className="accommodation-grid">
                        {accommodations.map((item) => (
                          <article className="accommodation-card" key={item.id}>
                            {item.image_url ? (
                              <img
                                className="accommodation-card__image"
                                src={item.image_url}
                                alt={item.name}
                                loading="lazy"
                              />
                            ) : (
                              <div className="accommodation-card__placeholder">
                                <Icon name="bed-double" size={30} />
                                <span>ACCOMMODATION</span>
                              </div>
                            )}

                            <div className="accommodation-card__body">
                              <span className="destination-card__category">
                                {item.accommodation_type}
                              </span>
                              <h3>{item.name}</h3>
                              <p className="accommodation-card__location">
                                <Icon name="pin" size={14} />
                                {item.location || currentDestination.region}
                              </p>
                              <p className="accommodation-card__description">
                                {item.description}
                              </p>

                              <div className="accommodation-card__footer">
                                <div>
                                  <strong>
                                    {item.estimated_nightly_rate
                                      ? `KES ${Number(item.estimated_nightly_rate).toLocaleString('en-KE')}`
                                      : 'Contact provider'}
                                  </strong>
                                  <span>
                                    {item.estimated_nightly_rate
                                      ? 'Indicative rate per night'
                                      : 'For current rates'}
                                  </span>
                                </div>

                                {item.website_url && (
                                  <a
                                    className="accommodation-card__link"
                                    href={item.website_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                  >
                                    Visit website
                                    <Icon name="arrowRight" size={15} />
                                  </a>
                                )}
                              </div>
                            </div>
                          </article>
                        ))}
                      </div>
                    )}

                  <p className="accommodation-disclaimer">
                    Rates are indicative where provided. Contact accommodation
                    providers directly to confirm current prices and availability.
                    Safari Planner does not process accommodation reservations.
                  </p>
                </section>
              </>
            ) : destinationsLoading ? (
              <div className="destination-detail__content">
                <p className="destination-status">Loading destination...</p>
              </div>
            ) : (
              <div className="destination-detail__content">
                <h1>Destination not found</h1>
                <p>This destination may no longer be available.</p>
                <Link className="text-link" to="/explore">
                  Explore destinations
                </Link>
              </div>
            )}
          </section>
        )}

        <section className="hero" id="home">
          <img
            className="hero__image"
            src={safariHeroImage}
            alt="Lion in the Kenyan savannah"
          />
          <div className="hero__overlay" />

          <div className="hero__content">
            <span className="eyebrow eyebrow--light">
              <span className="eyebrow__line" />
              EXPLORE KENYA
            </span>

            <h1>
              Plan Your
              <br />
              <em>Kenyan Safari.</em>
            </h1>

            <p className="hero__description">
              Discover Kenya’s iconic wildlife, breathtaking landscapes
              and unique safari experiences. Plan, personalize and
              manage your journey — all in one place.
            </p>

            <div className="hero__actions">
              <button className="button button--gold" onClick={scrollToPlanner}>
                Plan a trip <Icon name="arrow" size={17} />
              </button>
              <a className="hero__text-link" href="#destinations">
                Explore destinations <Icon name="arrowRight" size={18} />
              </a>
            </div>

            <div className="hero__footnote">
              <span className="hero__footnote-icon">
                <Icon name="compass" size={20} />
              </span>
              <span>
                MADE FOR THE CURIOUS
                <small>Discover places worth remembering.</small>
              </span>
            </div>
          </div>

          <span className="hero__index">01 / YOUR NEXT CHAPTER</span>
          <a className="hero__scroll" href="#destinations">
            SCROLL TO EXPLORE <span />
          </a>
        </section>

        <section className="intro-strip" aria-label="Our travel philosophy">
          <span>THOUGHTFULLY CURATED</span>
          <i />
          <span>DEEPLY PERSONAL</span>
          <i />
          <span>ROOTED IN DISCOVERY</span>
        </section>

        <section className="destinations section-shell" id="destinations">
          <div className="section-heading">
            <div>
              <span className="eyebrow">
                <span className="eyebrow__line" />
                FIND YOUR SOMEWHERE
              </span>
              <h2>
                Places that stay
                <br />
                <em>with you.</em>
              </h2>
            </div>
            <p className="section-heading__description">
              The familiar, the unexpected, and the places you haven't
              discovered yet. Your next favourite place is waiting.
            </p>
          </div>

          {isExplorePage && (
            <div className="explore-tools">
              <div className="explore-tools__search">
                <Icon name="search" size={19} />
                <input
                  type="search"
                  placeholder="Search destinations, regions or countries..."
                  value={destinationSearch}
                  onChange={(event) => setDestinationSearch(event.target.value)}
                  aria-label="Search destinations"
                />
                {destinationSearch && (
                  <button
                    type="button"
                    onClick={() => setDestinationSearch('')}
                    aria-label="Clear search"
                  >
                    <Icon name="close" size={17} />
                  </button>
                )}
              </div>

              <div className="explore-tools__filters">
                <span className="explore-tools__label">EXPLORE BY</span>

                <button
                  type="button"
                  className={`explore-filter ${selectedCategory === 'All' ? 'is-active' : ''}`}
                  onClick={() => setSelectedCategory('All')}
                >
                  All places
                </button>

                {destinationCategories.map((category) => (
                  <button
                    type="button"
                    key={category}
                    className={`explore-filter ${selectedCategory === category ? 'is-active' : ''}`}
                    onClick={() => setSelectedCategory(category)}
                  >
                    {category}
                  </button>
                ))}
              </div>

              <div className="explore-tools__results">
                <span>
                  {filteredDestinations.length} destination
                  {filteredDestinations.length === 1 ? '' : 's'} found
                </span>

                {(destinationSearch || selectedCategory !== 'All') && (
                  <button
                    type="button"
                    onClick={() => {
                      setDestinationSearch('');
                      setSelectedCategory('All');
                    }}
                  >
                    Clear filters
                  </button>
                )}
              </div>
            </div>
          )}

          {destinationsLoading && (
            <p className="destination-status" role="status">
              Discovering destinations...
            </p>
          )}

          {destinationsError && (
            <p className="destination-status" role="alert">
              {destinationsError}
            </p>
          )}

          {!destinationsLoading &&
            !destinationsError &&
            destinations.length === 0 && (
              <p className="destination-status">
                No destinations are available yet.
              </p>
            )}

          {isExplorePage &&
            !destinationsLoading &&
            !destinationsError &&
            destinations.length > 0 &&
            filteredDestinations.length === 0 && (
              <p className="destination-status">
                No destinations match your search. Try another name or category.
              </p>
            )}

          {isExplorePage && (
            <section className="recommendation-panel">
              <div className="recommendation-panel__heading">
                <span className="eyebrow">
                  <span className="eyebrow__line" />
                  YOUR NEXT ADVENTURE
                </span>
                <h2>Picked for <em>your journey.</em></h2>
                <p>
                  Tell us what inspires you and discover Kenyan destinations
                  that match your travel preferences.
                </p>
              </div>

              <form
                className="recommendation-form"
                onSubmit={async (event) => {
                  event.preventDefault();
                  setRecommendationsLoading(true);
                  setRecommendationsError('');
                  setRecommendations([]);

                  try {
                    const params = new URLSearchParams({
                      travel_style: recommendationStyle,
                      duration_days: recommendationDays,
                      limit: '6',
                    });

                    if (recommendationBudget.trim()) {
                      params.set('budget', recommendationBudget.trim());
                    }

                    recommendationInterests
                      .split(',')
                      .map((interest) => interest.trim())
                      .filter(Boolean)
                      .forEach((interest) => params.append('interest', interest));

                    const response = await fetch(
                      `${API_BASE_URL}/recommendations?${params.toString()}`
                    );
                    const result = await response.json();

                    if (!response.ok) {
                      throw new Error(
                        result.error || 'Unable to load recommendations.'
                      );
                    }

                    setRecommendations(result.recommendations || []);

                    if (!result.recommendations?.length) {
                      setRecommendationsError(
                        'No destinations match this budget. Try adjusting your preferences.'
                      );
                    }
                  } catch (error) {
                    setRecommendationsError(
                      error.message === 'Failed to fetch'
                        ? 'Could not connect to the recommendation service. Check that the backend is running.'
                        : error.message || 'Unable to load recommendations.'
                    );
                  } finally {
                    setRecommendationsLoading(false);
                  }
                }}
              >
                <label>
                  Travel style
                  <select
                    value={recommendationStyle}
                    onChange={(event) => setRecommendationStyle(event.target.value)}
                  >
                    <option>Wildlife & Safari</option>
                    <option>Nature & Adventure</option>
                    <option>Coastal Escape</option>
                    <option>Culture & Heritage</option>
                    <option>Relaxation & Wellness</option>
                  </select>
                </label>

                <label>
                  Interests
                  <input
                    type="text"
                    value={recommendationInterests}
                    onChange={(event) => setRecommendationInterests(event.target.value)}
                    placeholder="e.g. wildlife, beach, birdlife"
                  />
                  <small>Separate interests with commas.</small>
                </label>

                <label>
                  Total budget (KES)
                  <input
                    type="number"
                    min="0"
                    step="100"
                    value={recommendationBudget}
                    onChange={(event) => setRecommendationBudget(event.target.value)}
                    placeholder="Your total budget"
                  />
                </label>

                <label>
                  Travel days
                  <input
                    type="number"
                    min="1"
                    max="30"
                    value={recommendationDays}
                    onChange={(event) => setRecommendationDays(event.target.value)}
                    required
                  />
                </label>

                <button
                  className="recommendation-form__submit"
                  type="submit"
                  disabled={recommendationsLoading}
                >
                  {recommendationsLoading
                    ? 'Finding destinations...'
                    : 'Find my destinations'}
                  <Icon name="arrowRight" size={17} />
                </button>
              </form>

              {recommendationsError && (
                <p className="recommendation-message" role="status">
                  {recommendationsError}
                </p>
              )}

              {recommendations.length > 0 && (
                <div className="recommendation-results">
                  <div className="recommendation-results__heading">
                    <h3>Your recommended destinations</h3>
                    <span>{recommendations.length} matches</span>
                  </div>

                  <div className="destination-grid">
                    {recommendations.map((destination, index) => (
                      <article
                        className="destination-card recommendation-card"
                        key={destination.id}
                      >
                        <button
                          className="destination-card__image-button"
                          onClick={() => navigate(`/destinations/${destination.id}`)}
                          aria-label={`View ${destination.name} details`}
                        >
                          <img
                            src={destination.image_url || heroImage}
                            alt={destination.name}
                            loading="lazy"
                            onError={(event) => {
                              event.currentTarget.onerror = null;
                              event.currentTarget.src = heroImage;
                            }}
                          />
                          <span className="destination-card__number">
                            0{index + 1}
                          </span>
                        </button>

                        <div className="destination-card__body">
                          <span className="destination-card__category">
                            {destination.category}
                          </span>
                          <h3>{destination.name}</h3>
                          <p>
                            <Icon name="pin" size={15} />
                            {destination.region}, Kenya
                          </p>
                          <div className="recommendation-card__cost">
                            <strong>
                              {destination.estimated_daily_cost_kes
                                ? `KES ${Number(destination.estimated_daily_cost_kes).toLocaleString('en-KE')}`
                                : 'Cost estimate unavailable'}
                            </strong>
                            <span>Estimated per day</span>
                            {destination.estimated_total_cost_kes && (
                              <div className="recommendation-card__total">
                                <strong>
                                  KES {Number(destination.estimated_total_cost_kes).toLocaleString('en-KE')}
                                </strong>
                                <span>Estimated total for {recommendationDays} days</span>
                              </div>
                            )}
                          </div>
                          <ul className="recommendation-card__reasons">
                            {destination.reasons.map((reason) => (
                              <li key={reason}>{reason}</li>
                            ))}
                          </ul>
                        </div>
                      </article>
                    ))}
                  </div>

                  <p className="recommendation-disclaimer">
                    Cost figures are indicative planning estimates, not confirmed
                    prices or booking quotations.
                  </p>
                </div>
              )}
            </section>
          )}

          <div className="destination-grid">
            {(isExplorePage ? filteredDestinations : destinations).map((destination, index) => (
              <article className="destination-card" key={destination.name}>
                <button
                  className="destination-card__image-button"
                  onClick={() => navigate(`/destinations/${destination.id}`)}
                  aria-label={`View ${destination.name} details`}
                >
                  <img
                    src={destination.image_url || heroImage}
                    alt={destination.name}
                    loading="lazy"
                    onError={(event) => {
                      event.currentTarget.onerror = null;
                      event.currentTarget.src = heroImage;
                    }}
                  />
                  <span className="destination-card__number">
                    0{index + 1}
                  </span>
                  <span className="destination-card__arrow">
                    <Icon name="arrow" size={19} />
                  </span>
                </button>

                <div className="destination-card__body">
                  <span className="destination-card__category">
                    {destination.category}
                  </span>
                  <h3>{destination.name}</h3>
                  <p>
                    <Icon name="pin" size={15} />
                    {[destination.region, destination.country].filter(Boolean).join(', ')}
                  </p>
                </div>
              </article>
            ))}
          </div>

          <a className="text-link" href="#plan-trip">
            Find your own hidden gem <Icon name="arrowRight" size={18} />
          </a>
        </section>

        <section className="philosophy" id="why-us">
          <div className="philosophy__visual">
            <img
              src={destinations[0]?.image_url || heroImage}
              alt="Wildlife in an African landscape"
              loading="lazy"
            />
            <div className="philosophy__caption">
              <Icon name="leaf" size={21} />
              <span>
                GO BEYOND THE GUIDEBOOK
                <small>Travel with intention.</small>
              </span>
            </div>
          </div>

          <div className="philosophy__content">
            <span className="eyebrow">
              <span className="eyebrow__line" />
              THE SAFARI PLANNER DIFFERENCE
            </span>
            <h2>
              Your interests.
              <br />
              Your pace.
              <br />
              <em>Your Africa.</em>
            </h2>
            <p>
              Great journeys aren't one-size-fits-all. Start with what inspires
              you, set your own pace, and bring your ideas together in one
              thoughtful travel plan.
            </p>

            <div className="philosophy__points">
              <div>
                <span>01</span>
                <p>
                  <strong>Made personal</strong>
                  Shape your trip around your interests.
                </p>
              </div>
              <div>
                <span>02</span>
                <p>
                  <strong>Made practical</strong>
                  Keep your itinerary and budget in view.
                </p>
              </div>
              <div>
                <span>03</span>
                <p>
                  <strong>Made yours</strong>
                  Review, refine and save your plans.
                </p>
              </div>
            </div>

            <button className="button button--dark" onClick={scrollToPlanner}>
              Let's plan something <Icon name="arrow" size={17} />
            </button>
          </div>
        </section>

        <section className="planner section-shell" id="plan-trip">
          <div className="planner__heading">
            <span className="eyebrow">
              <span className="eyebrow__line" />
              THE FIRST STEP
            </span>
            <h2>
              Where will your
              <br />
              <em>story take you?</em>
            </h2>
            <p>
              Tell us a little about the trip you're imagining. You can refine
              your plans as you go.
            </p>
          </div>

          <form className="planner-form" onSubmit={submitTrip}>
            <label>
              Destination
              <span className="input-wrap">
                <Icon name="pin" size={18} />
                <input
                  name="destination"
                  value={trip.destination}
                  onChange={updateTrip}
                  placeholder="Where would you love to go?"
                  maxLength={150}
                  required
                />
              </span>
            </label>

            <div className="planner-form__dates">
              <label>
                Start date
                <span className="input-wrap">
                  <Icon name="calendar" size={17} />
                  <input
                    name="startDate"
                    type="date"
                    value={trip.startDate}
                    onChange={updateTrip}
                    required
                  />
                </span>
              </label>

              <label>
                End date
                <span className="input-wrap">
                  <Icon name="calendar" size={17} />
                  <input
                    name="endDate"
                    type="date"
                    min={trip.startDate || undefined}
                    value={trip.endDate}
                    onChange={updateTrip}
                    required
                  />
                </span>
              </label>
            </div>

            <label>
              What kind of journey?
              <select
                name="travelStyle"
                value={trip.travelStyle}
                onChange={updateTrip}
              >
                <option>Wildlife & Safari</option>
                <option>Nature & Adventure</option>
                <option>Coastal Escape</option>
                <option>Culture & Heritage</option>
                <option>Relaxation & Wellness</option>
              </select>
            </label>

            <label>
              Approximate budget (KES)
              <input
                name="budget"
                type="number"
                min="0"
                step="0.01"
                value={trip.budget}
                onChange={updateTrip}
                placeholder="e.g. 50000"
              />
            </label>

            <button
              className="button button--gold planner-form__submit"
              type="submit"
              disabled={isSaving}
            >
              {isSaving ? 'Generating itinerary…' : 'Generate my itinerary'}
              {!isSaving && <Icon name="arrow" size={17} />}
            </button>

            {/* ADDED: Real success and error feedback from the API request. */}
            {submitted && savedPreference && generatedItinerary && (
              <div className="planner-feedback" role="status">
                <strong>Your itinerary has been generated.</strong>
                <p>
                  {savedPreference.destination} · {savedPreference.travel_style}
                </p>
                <small>
                  Itinerary #{generatedItinerary.itinerary_id}. Your
                  {` ${generatedItinerary.plan.duration_days}-day `}
                  plan has been saved and is ready to review.
                </small>
              </div>
            )}

            {error && (
              <div className="planner-feedback planner-feedback--error" role="alert">
                <strong>We couldn't save your trip.</strong>
                <p>{error}</p>
              </div>
            )}

            {submitted && generatedItinerary?.plan && (
              <section
                className="generated-itinerary"
                aria-labelledby="generated-itinerary-title"
              >
                <div className="generated-itinerary__header">
                  <p className="eyebrow">YOUR JOURNEY, CURATED</p>
                  <h3 id="generated-itinerary-title">
                    Your {generatedItinerary.plan.duration_days}-day itinerary
                  </h3>
                  <p>
                    {generatedItinerary.plan.destination}
                    {generatedItinerary.plan.destination_details?.region
                      ? ` · ${generatedItinerary.plan.destination_details.region}`
                      : ""}
                  </p>
                  <div className="generated-itinerary__summary">
                    <span>
                      <strong>Start</strong>
                      {generatedItinerary.plan.start_date}
                    </span>
                    <span>
                      <strong>End</strong>
                      {generatedItinerary.plan.end_date}
                    </span>
                    <span>
                      <strong>Budget</strong>
                      {generatedItinerary.plan.budget_kes == null
                        ? "Not specified"
                        : `KES ${Number(
                            generatedItinerary.plan.budget_kes,
                          ).toLocaleString("en-KE")}`}
                    </span>
                  </div>
                </div>

                <div className="generated-itinerary__days">
                  {generatedItinerary.plan.days.map((day) => (
                    <article
                      className="itinerary-day"
                      key={`${day.day}-${day.date}`}
                    >
                      <div className="itinerary-day__heading">
                        <span className="itinerary-day__number">
                          {String(day.day).padStart(2, "0")}
                        </span>
                        <div>
                          <h4>Day {day.day}</h4>
                          <p>{day.date}</p>
                        </div>
                      </div>

                      <div className="itinerary-day__activities">
                        {day.activities.map((activity, index) => (
                          <div
                            className="itinerary-activity"
                            key={`${day.day}-${activity.time}-${index}`}
                          >
                            <span className="itinerary-activity__time">
                              {activity.time}
                            </span>
                            <div>
                              <h5>{activity.title}</h5>
                              <p>{activity.description}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </article>
                  ))}
                </div>

                <p className="generated-itinerary__notice">
                  {generatedItinerary.plan.notice}
                </p>
              </section>
            )}
          </form>
        </section>

        <section className="saved-trips section-shell" id="saved-trips">
          <div className="saved-trips__heading">
            <span className="eyebrow">
              <span className="eyebrow__line" />
              YOUR TRAVEL COLLECTION
            </span>
            <h2>
              Journeys worth
              <br />
              <em>keeping.</em>
            </h2>
            <p>
              Revisit the travel plans you've created and keep your next
              adventure within reach.
            </p>
          </div>

          {!savedItinerariesLoading && savedItineraries.length > 0 && (
            <div className="my-trips-dashboard">
              <div className="my-trips-dashboard__welcome">
                <div>
                  <span className="eyebrow">
                    <span className="eyebrow__line" />
                    YOUR TRAVEL OVERVIEW
                  </span>
                  <h3>Your journeys, <em>at a glance.</em></h3>
                </div>
                <Link className="button button--dark" to="/plan-trip">
                  Plan another trip <Icon name="arrow" size={16} />
                </Link>
              </div>

              <div className="my-trips-stats">
                <article className="my-trips-stat my-trips-stat--total">
                  <span>TOTAL JOURNEYS</span>
                  <strong>{savedItineraries.length}</strong>
                  <small>Saved in your collection</small>
                </article>
                <article className="my-trips-stat">
                  <span>UPCOMING</span>
                  <strong>{upcomingTrips}</strong>
                  <small>Journeys ahead</small>
                </article>
                <article className="my-trips-stat">
                  <span>IN PROGRESS</span>
                  <strong>{ongoingTrips}</strong>
                  <small>Happening now</small>
                </article>
                <article className="my-trips-stat">
                  <span>COMPLETED</span>
                  <strong>{pastTrips}</strong>
                  <small>Memories made</small>
                </article>
              </div>

              <div className="my-trips-toolbar">
                <div className="my-trips-toolbar__search">
                  <Icon name="search" size={18} />
                  <input
                    type="search"
                    placeholder="Search your journeys..."
                    value={tripSearch}
                    onChange={(event) => setTripSearch(event.target.value)}
                    aria-label="Search saved trips"
                  />
                </div>

                <div className="my-trips-toolbar__filters" aria-label="Filter trips">
                  {[
                    ["all", "All trips"],
                    ["upcoming", "Upcoming"],
                    ["ongoing", "In progress"],
                    ["past", "Completed"],
                    ["pending", "Dates pending"],
                  ].map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      className={tripFilter === value ? "is-active" : ""}
                      onClick={() => setTripFilter(value)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {selectedItineraryLoading && (
            <p className="saved-trips__message" role="status">
              Opening your saved itinerary...
            </p>
          )}

          {selectedItineraryError && (
            <p className="saved-trips__message" role="alert">
              {selectedItineraryError}
            </p>
          )}

          {selectedItinerary?.plan && (
            <section
              className="saved-itinerary-detail"
              aria-labelledby="saved-itinerary-detail-title"
            >
              <button
                className="saved-itinerary-detail__back"
                type="button"
                onClick={() => {
                  setSelectedItinerary(null);
                  setSelectedItineraryError("");
                  setIsEditingTrip(false);
                  setEditTripError("");
                  setEditTripSuccess("");
                }}
              >
                <Icon name="arrowLeft" size={16} />
                Back to saved trips
              </button>

              <div className="saved-itinerary-detail__header">
                <span className="eyebrow">
                  <span className="eyebrow__line" />
                  YOUR JOURNEY, CURATED
                </span>
                <h3 id="saved-itinerary-detail-title">
                  {selectedItinerary.plan.destination}
                </h3>
                <p>
                  {selectedItinerary.plan.destination_details?.region ||
                    selectedItinerary.plan.destination_details?.country ||
                    "Your saved destination"}
                  {" · "}
                  {selectedItinerary.plan.duration_days}{" "}
                  {selectedItinerary.plan.duration_days === 1 ? "day" : "days"}
                </p>
              </div>

              <div className="saved-itinerary-detail__actions">
                {!isEditingTrip && (
                  <button
                    className="button button--dark"
                    type="button"
                    onClick={beginEditingTrip}
                  >
                    Edit trip
                  </button>
                )}
              </div>

              {editTripSuccess && (
                <p className="saved-trip-edit__success" role="status">
                  {editTripSuccess}
                </p>
              )}

              {isEditingTrip && (
                <form
                  className="saved-trip-edit"
                  onSubmit={submitEditTrip}
                >
                  <div className="saved-trip-edit__heading">
                    <span className="eyebrow">
                      <span className="eyebrow__line" />
                      REFINE YOUR JOURNEY
                    </span>
                    <h4>Edit your trip</h4>
                    <p>
                      Update your preferences and we'll refresh your itinerary.
                    </p>
                  </div>

                  <label>
                    Destination
                    <input
                      name="destination"
                      value={editTrip.destination}
                      onChange={updateEditTrip}
                      maxLength={150}
                      required
                    />
                  </label>

                  <div className="saved-trip-edit__dates">
                    <label>
                      Start date
                      <input
                        name="startDate"
                        type="date"
                        value={editTrip.startDate}
                        onChange={updateEditTrip}
                        required
                      />
                    </label>

                    <label>
                      End date
                      <input
                        name="endDate"
                        type="date"
                        min={editTrip.startDate || undefined}
                        value={editTrip.endDate}
                        onChange={updateEditTrip}
                        required
                      />
                    </label>
                  </div>

                  <label>
                    Travel style
                    <select
                      name="travelStyle"
                      value={editTrip.travelStyle}
                      onChange={updateEditTrip}
                    >
                      <option>Wildlife & Safari</option>
                      <option>Nature & Adventure</option>
                      <option>Coastal Escape</option>
                      <option>Culture & Heritage</option>
                      <option>Relaxation & Wellness</option>
                    </select>
                  </label>

                  <label>
                    Approximate budget (KES)
                    <input
                      name="budget"
                      type="number"
                      min="0"
                      step="0.01"
                      value={editTrip.budget}
                      onChange={updateEditTrip}
                      placeholder="e.g. 50000"
                    />
                  </label>

                  {editTripError && (
                    <p className="saved-trip-edit__error" role="alert">
                      {editTripError}
                    </p>
                  )}

                  <div className="saved-trip-edit__actions">
                    <button
                      className="button button--gold"
                      type="submit"
                      disabled={isUpdatingTrip}
                    >
                      {isUpdatingTrip ? "Saving changes..." : "Save changes"}
                    </button>

                    <button
                      className="saved-trip-edit__cancel"
                      type="button"
                      disabled={isUpdatingTrip}
                      onClick={() => {
                        setIsEditingTrip(false);
                        setEditTripError("");
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              )}

              <div className="saved-itinerary-detail__summary">
                <span>
                  <strong>Start date</strong>
                  {selectedItinerary.plan.start_date}
                </span>
                <span>
                  <strong>End date</strong>
                  {selectedItinerary.plan.end_date}
                </span>
                <span>
                  <strong>Travel style</strong>
                  {selectedItinerary.plan.travel_style || "Not specified"}
                </span>
                <span>
                  <strong>Total budget</strong>
                  {selectedItinerary.plan.budget_kes == null
                    ? "Not specified"
                    : `KES ${Number(
                        selectedItinerary.plan.budget_kes,
                      ).toLocaleString("en-KE")}`}
                </span>
              </div>

              <div className="saved-itinerary-detail__days">
                {(selectedItinerary.plan.days || []).map((day) => (
                  <article
                    className="itinerary-day"
                    key={`${day.day}-${day.date}`}
                  >
                    <div className="itinerary-day__heading">
                      <span className="itinerary-day__number">
                        {String(day.day).padStart(2, "0")}
                      </span>
                      <div>
                        <h4>Day {day.day}</h4>
                        <p>{day.date}</p>
                      </div>
                    </div>

                    <div className="itinerary-day__activities">
                      {(day.activities || []).map((activity, index) => (
                        <div
                          className="itinerary-activity"
                          key={`${day.day}-${activity.time}-${index}`}
                        >
                          <span className="itinerary-activity__time">
                            {activity.time}
                          </span>
                          <div>
                            <h5>{activity.title}</h5>
                            <p>{activity.description}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </article>
                ))}
              </div>

              <p className="generated-itinerary__notice">
                {selectedItinerary.plan.notice}
              </p>
            </section>
          )}

          {deleteItineraryError && (
            <p className="saved-trips__message" role="alert">
              {deleteItineraryError}
            </p>
          )}

          {savedItinerariesLoading ? (
            <p className="saved-trips__message" role="status">
              Loading your saved trips...
            </p>
          ) : savedItinerariesError ? (
            <p className="saved-trips__message" role="alert">
              {savedItinerariesError}
            </p>
          ) : savedItineraries.length === 0 ? (
            <div className="saved-trips__empty">
              <h3>Your next story starts here.</h3>
              <p>
                You haven't saved an itinerary yet. Start planning a journey
                and it will appear here.
              </p>
              <button
                className="button button--dark"
                onClick={scrollToPlanner}
                type="button"
              >
                Plan your first trip <Icon name="arrow" size={17} />
              </button>
            </div>
          ) : filteredSavedItineraries.length === 0 ? (
              <div className="saved-trips__empty">
                <h3>No journeys found.</h3>
                <p>Try another search or choose a different trip filter.</p>
                <button
                  className="button button--dark"
                  type="button"
                  onClick={() => {
                    setTripSearch("");
                    setTripFilter("all");
                  }}
                >
                  Clear filters
                </button>
              </div>
            ) : (
            <div className="saved-trips__grid">
              {filteredSavedItineraries.map((itinerary) => (
                <article
                  className="saved-trip-card"
                  key={itinerary.itinerary_id}
                >
                  <div className="saved-trip-card__top">
                    <span className={`saved-trip-card__status saved-trip-card__status--${getTripStatus(itinerary)}`}>
                      {{
                        upcoming: "Upcoming",
                        ongoing: "In progress",
                        past: "Completed",
                        pending: "Dates pending",
                      }[getTripStatus(itinerary)]}
                    </span>
                    <span>
                      {itinerary.destination_details?.region ||
                        itinerary.destination_details?.country ||
                        "Kenya"}
                    </span>
                    <span>
                      {itinerary.duration_days}{" "}
                      {itinerary.duration_days === 1 ? "day" : "days"}
                    </span>
                  </div>
                  <h3>{itinerary.destination || "Untitled journey"}</h3>
                  <p className="saved-trip-card__dates">
                    {itinerary.start_date || "Date not set"}
                    {itinerary.end_date ? ` — ${itinerary.end_date}` : ""}
                  </p>
                  <div className="saved-trip-card__details">
                    <span>
                      <strong>Travel style</strong>
                      {itinerary.travel_style || "Not specified"}
                    </span>
                    <span>
                      <strong>Estimated budget</strong>
                      {itinerary.budget_kes == null
                        ? "Not specified"
                        : `KES ${Number(
                            itinerary.budget_kes,
                          ).toLocaleString("en-KE")}`}
                    </span>
                  </div>
                  <p className="saved-trip-card__reference">
                    Itinerary #{itinerary.itinerary_id}
                  </p>
                  <div className="saved-trip-card__actions">
                    <button
                      className="saved-trip-card__action"
                      type="button"
                      onClick={() =>
                        openSavedItinerary(itinerary.itinerary_id)
                      }
                      disabled={
                        selectedItineraryLoading ||
                        deletingItineraryId !== null
                      }
                    >
                      View itinerary <Icon name="arrowRight" size={16} />
                    </button>
                    <button
                      className="saved-trip-card__delete"
                      type="button"
                      onClick={() =>
                        deleteSavedItinerary(itinerary.itinerary_id)
                      }
                      disabled={
                        deletingItineraryId !== null ||
                        selectedItineraryLoading
                      }
                    >
                      {deletingItineraryId === itinerary.itinerary_id
                        ? "Deleting..."
                        : "Delete trip"}
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
              </>
            )}
          </>
        )}
      </main>

      <footer className="site-footer">
        <Link className="brand brand--footer" to="/">
          <span className="brand__mark">
            <Icon name="compass" size={24} />
          </span>
          <span className="brand__name">
            safari<span>planner</span>
            <small>YOUR JOURNEY, CURATED</small>
          </span>
        </Link>

        <p>Thoughtful journeys. Lasting stories.</p>
        <span className="site-footer__copyright">
          © {new Date().getFullYear()} Safari Planner
        </span>
      </footer>
    </>
  );
}

export default App;
