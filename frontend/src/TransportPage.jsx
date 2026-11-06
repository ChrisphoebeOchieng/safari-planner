import { useEffect, useState } from 'react';
import './TransportPage.css';

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:5000/api';

const transportTypes = [
  { value: '', label: 'All transport' },
  { value: 'flight', label: 'Flights' },
  { value: 'bus', label: 'Buses' },
  { value: 'sgr', label: 'SGR' },
];

function formatFare(value) {
  if (value == null || value === '') return 'Fare unavailable';

  const amount = Number(value);
  if (!Number.isFinite(amount)) return 'Fare unavailable';

  return `KES ${amount.toLocaleString('en-KE', {
    maximumFractionDigits: 0,
  })}`;
}

const transportPhotos = {
  flight: 'https://images.unsplash.com/photo-1436491865332-7a61a109cc05?auto=format&fit=crop&w=1200&q=85',
  bus: 'https://images.unsplash.com/photo-1570125909232-eb263c188f7e?auto=format&fit=crop&w=1200&q=85',
  sgr: 'https://images.unsplash.com/photo-1474487548417-781cb71495f3?auto=format&fit=crop&w=1200&q=85',
};

function formatDuration(minutes) {
  if (minutes == null || !Number.isFinite(Number(minutes))) {
    return 'Duration unavailable';
  }

  const hours = Math.floor(Number(minutes) / 60);
  const remainingMinutes = Number(minutes) % 60;

  if (!hours) return `${remainingMinutes} min`;
  if (!remainingMinutes) return `${hours} hr`;

  return `${hours} hr ${remainingMinutes} min`;
}

function TransportPage() {
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [transportType, setTransportType] = useState('');
  const [sortBy, setSortBy] = useState('fare');
  const [options, setOptions] = useState([]);
  const [disclaimer, setDisclaimer] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function loadTransport(event) {
    event?.preventDefault();

    setLoading(true);
    setError('');

    const params = new URLSearchParams({
      sort_by: sortBy,
      limit: '100',
    });

    if (origin.trim()) params.set('origin', origin.trim());
    if (destination.trim()) params.set('destination', destination.trim());
    if (transportType) params.set('type', transportType);

    try {
      const response = await fetch(
        `${API_BASE_URL}/transport?${params.toString()}`
      );
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Unable to load transport options.');
      }

      const providerOrder = {
        'Kenya Airways': 1,
        'Jambojet': 2,
        'Mash Poa': 3,
        'Easy Coach': 4,
        'Modern Coast': 5,
        'Kenya Railways – Madaraka Express': 6,
      };

      const transportOptions = Array.isArray(result.transport_options)
        ? [...result.transport_options].sort(
            (a, b) =>
              (providerOrder[a.provider] ?? 99) -
              (providerOrder[b.provider] ?? 99)
          )
        : [];

      setOptions(transportOptions);
      setDisclaimer(result.disclaimer || '');
    } catch (err) {
      setOptions([]);
      setError(
        err.message === 'Failed to fetch'
          ? 'We could not connect to the transport service. Please check that the server is running.'
          : err.message || 'Unable to load transport options.'
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadTransport();
  }, []);

  return (
    <section className="transport-page section-shell">
      <div className="transport-hero">
        <div className="transport-hero__content">
          <span className="eyebrow">
            <span className="eyebrow__line" />
            GETTING AROUND KENYA
          </span>
          <h1>
            The journey is
            <br />
            <em>part of the story.</em>
          </h1>
          <p>
            Compare flights, buses and the SGR to find a travel option
            that suits your route, time and budget.
          </p>
        </div>
        
      </div>

      <form className="transport-search" onSubmit={loadTransport}>
        <label>
          From
          <input
            value={origin}
            onChange={(event) => setOrigin(event.target.value)}
            placeholder="e.g. Nairobi"
            maxLength={150}
          />
        </label>

        <label>
          To
          <input
            value={destination}
            onChange={(event) => setDestination(event.target.value)}
            placeholder="e.g. Mombasa"
            maxLength={150}
          />
        </label>

        <label>
          Transport type
          <select
            value={transportType}
            onChange={(event) => setTransportType(event.target.value)}
          >
            {transportTypes.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
        </label>

        <label>
          Sort results
          <select
            value={sortBy}
            onChange={(event) => setSortBy(event.target.value)}
          >
            <option value="fare">Lowest fare</option>
            <option value="duration">Shortest journey</option>
          </select>
        </label>

        <button type="submit" disabled={loading}>
          {loading ? 'Searching...' : 'Compare transport'}
        </button>
      </form>

      <div className="transport-results-heading">
        <div>
          <span className="eyebrow">
            <span className="eyebrow__line" />
            YOUR ROUTE OPTIONS
          </span>
          <h2>Compare your <em>journey.</em></h2>
        </div>
        {!loading && !error && (
          <span className="transport-results-count">
            {options.length} {options.length === 1 ? 'option' : 'options'}
          </span>
        )}
      </div>

      <div className="transport-type-filters" aria-label="Filter transport">
        {transportTypes.map((type) => (
          <button
            key={type.value}
            type="button"
            className={transportType === type.value ? 'is-active' : ''}
            onClick={() => {
              setTransportType(type.value);
              setLoading(true);
              setError('');

              const params = new URLSearchParams({
                sort_by: sortBy,
                limit: '100',
              });

              if (origin.trim()) params.set('origin', origin.trim());
              if (destination.trim()) params.set('destination', destination.trim());
              if (type.value) params.set('type', type.value);

              fetch(`${API_BASE_URL}/transport?${params.toString()}`)
                .then(async (response) => {
                  const result = await response.json();
                  if (!response.ok) {
                    throw new Error(result.error || 'Unable to load transport options.');
                  }
                  setOptions(result.transport_options || []);
                  setDisclaimer(result.disclaimer || '');
                })
                .catch((err) => {
                  setOptions([]);
                  setError(err.message || 'Unable to load transport options.');
                })
                .finally(() => setLoading(false));
            }}
          >
            {type.label}
          </button>
        ))}
      </div>

      {loading && (
        <p className="transport-status" role="status">
          Finding transport options...
        </p>
      )}

      {error && (
        <p className="transport-status transport-status--error" role="alert">
          {error}
        </p>
      )}

      {!loading && !error && options.length === 0 && (
        <div className="transport-empty">
          <span aria-hidden="true">↗</span>
          <h3>No transport options found</h3>
          <p>
            There are currently no matching transport options. Try another
            route or transport type, or check back later.
          </p>
        </div>
      )}

      {!loading && !error && options.length > 0 && (
        <div className="transport-options">
          {options.map((option) => (
            <article className="transport-card" key={option.id}>
              <div className="transport-card__image-wrap">
                <img
                  className="transport-card__image"
                  src={option.image_url || transportPhotos[option.transport_type] || transportPhotos.flight}
                  alt={`${option.provider} transport vehicle`}
                  loading="lazy"
                />
                <span className="transport-card__image-label">
                  {option.transport_type === 'sgr'
                    ? 'RAIL JOURNEY'
                    : `${option.transport_type.toUpperCase()} JOURNEY`}
                </span>
              </div>
              <div className="transport-card__top">
                <span className="transport-card__type">
                  {option.transport_type === 'sgr'
                    ? 'SGR'
                    : option.transport_type}
                </span>
                <span className="transport-card__provider">
                  {option.provider}
                </span>
              </div>

              <div className="transport-card__route">
                <div>
                  <span>FROM</span>
                  <strong>{option.origin}</strong>
                  {option.departure_time && <small>{option.departure_time}</small>}
                </div>

                <span className="transport-card__arrow" aria-hidden="true"></span>

                <div>
                  <span>TO</span>
                  <strong>{option.destination}</strong>
                  {option.arrival_time && <small>{option.arrival_time}</small>}
                </div>
              </div>

              <div className="transport-card__details">
                <div>
                  <span>Estimated fare</span>
                  {option.estimated_fare != null ? (
                    <strong>{formatFare(option.estimated_fare)}</strong>
                  ) : option.booking_url ? (
                    <a
                      className="transport-card__fare-link"
                      href={option.booking_url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Visit provider ↗
                    </a>
                  ) : (
                    <strong>Contact provider</strong>
                  )}
                </div>
              </div>

              {option.notes && (
                <p className="transport-card__notes">{option.notes}</p>
              )}

              <div className="transport-card__footer">
                <span>Confirm current fares with the operator.</span>
              </div>
            </article>
          ))}
        </div>
      )}

      <p className="transport-disclaimer">
        {disclaimer ||
          'Fares and journey durations are indicative estimates. Confirm current prices, schedules and availability with the transport provider before travelling.'}
        {' '}Safari Planner does not sell tickets or guarantee availability.
      </p>
    </section>
  );
}

export default TransportPage;
