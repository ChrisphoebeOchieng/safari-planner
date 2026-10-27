import { useEffect, useState } from 'react';
import heroImage from './assets/hero.png';
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

  // ADDED: Destination data and API loading states.
  const [destinations, setDestinations] = useState([]);
  const [destinationsLoading, setDestinationsLoading] = useState(true);
  const [destinationsError, setDestinationsError] = useState('');

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
      setError('The end date cannot be before the start date.');
      return;
    }

    setIsSaving(true);
    setSubmitted(false);
    setError('');
    setSavedPreference(null);

    try {
      const response = await fetch(
        'http://127.0.0.1:5000/api/trip-preferences',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            destination: trip.destination.trim(),
            start_date: trip.startDate,
            end_date: trip.endDate,
            travel_style: trip.travelStyle,
            budget: trip.budget === '' ? null : Number(trip.budget),
          }),
        },
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error || 'Unable to save your trip preferences.',
        );
      }

      // ADDED: Use the actual saved record returned by the backend.
      setSavedPreference(result.preference);
      setSubmitted(true);
    } catch (err) {
      setError(
        err.message === 'Failed to fetch'
          ? 'Could not reach Safari Planner. Check that the Flask server is running on port 5000.'
          : err.message || 'Something went wrong. Please try again.',
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <header className="site-header">
        <a className="brand" href="#home" aria-label="Safari Planner home">
          <span className="brand__mark">
            <Icon name="compass" size={25} />
          </span>
          <span className="brand__name">
            safari<span>planner</span>
            <small>YOUR JOURNEY, CURATED</small>
          </span>
        </a>

        <button
          className="mobile-toggle"
          aria-label={mobileOpen ? 'Close navigation' : 'Open navigation'}
          aria-expanded={mobileOpen}
          onClick={() => setMobileOpen(!mobileOpen)}
        >
          <Icon name={mobileOpen ? 'close' : 'menu'} size={24} />
        </button>

        <nav className={`main-nav ${mobileOpen ? 'main-nav--open' : ''}`}>
          <a href="#destinations" onClick={() => setMobileOpen(false)}>
            Discover
          </a>
          <a href="#plan-trip" onClick={() => setMobileOpen(false)}>
            Plan a trip
          </a>
          <a href="#why-us" onClick={() => setMobileOpen(false)}>
            Our approach
          </a>
          <button className="nav-cta" onClick={scrollToPlanner}>
            Start planning <Icon name="arrow" size={16} />
          </button>
        </nav>
      </header>

      <main>
        <section className="hero" id="home">
          <img
            className="hero__image"
            src={heroImage}
            alt="African safari landscape"
          />
          <div className="hero__overlay" />

          <div className="hero__content">
            <span className="eyebrow eyebrow--light">
              <span className="eyebrow__line" />
              DISCOVER AFRICA DIFFERENTLY
            </span>

            <h1>
              Not just a trip.
              <br />
              <em>Your own story.</em>
            </h1>

            <p className="hero__description">
              From wild open plains to quiet coastal hideaways, create a
              journey that feels entirely yours.
            </p>

            <div className="hero__actions">
              <button className="button button--gold" onClick={scrollToPlanner}>
                Curate your journey <Icon name="arrow" size={17} />
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

          <div className="destination-grid">
            {destinations.map((destination, index) => (
              <article className="destination-card" key={destination.name}>
                <button
                  className="destination-card__image-button"
                  onClick={scrollToPlanner}
                  aria-label={`Plan a trip to ${destination.name}`}
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
              {isSaving ? 'Saving preferences…' : 'Save my preferences'}
              {!isSaving && <Icon name="arrow" size={17} />}
            </button>

            {/* ADDED: Real success and error feedback from the API request. */}
            {submitted && savedPreference && (
              <div className="planner-feedback" role="status">
                <strong>Your preferences have been saved!</strong>
                <p>
                  {savedPreference.destination} · {savedPreference.travel_style}
                </p>
                <small>
                  Reference: #{savedPreference.id}. Your trip preferences are
                  now stored in Safari Planner.
                </small>
              </div>
            )}

            {error && (
              <div className="planner-feedback planner-feedback--error" role="alert">
                <strong>We couldn't save your trip.</strong>
                <p>{error}</p>
              </div>
            )}
          </form>
        </section>
      </main>

      <footer className="site-footer">
        <a className="brand brand--footer" href="#home">
          <span className="brand__mark">
            <Icon name="compass" size={24} />
          </span>
          <span className="brand__name">
            safari<span>planner</span>
            <small>YOUR JOURNEY, CURATED</small>
          </span>
        </a>

        <p>Thoughtful journeys. Lasting stories.</p>
        <span className="site-footer__copyright">
          © {new Date().getFullYear()} Safari Planner
        </span>
      </footer>
    </>
  );
}

export default App;
