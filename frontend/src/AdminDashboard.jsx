import { useCallback, useEffect, useState } from 'react';
import './AdminDashboard.css';

const sections = [
  { id: 'overview', label: 'Overview', icon: '◫' },
  { id: 'destinations', label: 'Destinations', icon: '⌖' },
  { id: 'accommodations', label: 'Accommodations', icon: '⌂' },
  { id: 'transport', label: 'Transport', icon: '↗' },
  { id: 'users', label: 'Users', icon: '♧' },
];

const emptyDestination = {
  name: '',
  region: '',
  category: '',
  description: '',
  image_url: '',
  estimated_daily_cost: '',
  is_featured: false,
};

const emptyAccommodation = {
  destination_id: '',
  name: '',
  accommodation_type: 'Hotel',
  location: '',
  description: '',
  estimated_nightly_rate: '',
  image_url: '',
  website_url: '',
  contact_phone: '',
  is_featured: false,
};

const emptyTransport = {
  transport_type: 'sgr',
  provider: '',
  origin: '',
  destination: '',
  estimated_fare: '',
  duration_minutes: '',
  departure_time: '',
  arrival_time: '',
  booking_url: '',
  image_url: '',
  notes: '',
  is_active: true,
};

function AdminDashboard({ token, apiBaseUrl, onLogout }) {
  const [section, setSection] = useState('overview');
  const [statistics, setStatistics] = useState({});
  const [destinations, setDestinations] = useState([]);
  const [accommodations, setAccommodations] = useState([]);
  const [transportOptions, setTransportOptions] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [formType, setFormType] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyDestination);
  const [saving, setSaving] = useState(false);

  const request = useCallback(async (path, options = {}) => {
    const response = await fetch(`${apiBaseUrl}${path}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...options.headers,
      },
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || 'The request could not be completed.');
    }

    return result;
  }, [apiBaseUrl, token]);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const [dashboard, destinationData, accommodationData, transportData, userData] =
        await Promise.all([
          request('/admin/dashboard'),
          request('/admin/destinations'),
          request('/admin/accommodations'),
          request('/admin/transport'),
          request('/admin/users'),
        ]);

      setStatistics(dashboard.statistics || {});
      setDestinations(destinationData.destinations || []);
      setAccommodations(accommodationData.accommodations || []);
      setTransportOptions(transportData.transport_options || []);
      setUsers(userData.users || []);
    } catch (err) {
      setError(err.message || 'Unable to load the administration dashboard.');
    } finally {
      setLoading(false);
    }
  }, [request]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  function openCreate(type) {
    setFormType(type);
    setEditingId(null);
    setForm(
      type === 'destination' ? emptyDestination :
      type === 'accommodation' ? {
        ...emptyAccommodation,
        destination_id: destinations[0]?.id || '',
      } : emptyTransport
    );
    setNotice('');
    setError('');
  }

  function openEdit(type, item) {
    setFormType(type);
    setEditingId(item.id);

    if (type === 'destination') {
      setForm({
        name: item.name || '',
        region: item.region || '',
        category: item.category || '',
        description: item.description || '',
        image_url: item.image_url || '',
        estimated_daily_cost: item.estimated_daily_cost || '',
        is_featured: Boolean(item.is_featured),
      });
    } else if (type === 'accommodation') {
      setForm({
        destination_id: String(item.destination_id),
        name: item.name || '',
        accommodation_type: item.accommodation_type || 'Hotel',
        location: item.location || '',
        description: item.description || '',
        estimated_nightly_rate: item.estimated_nightly_rate || '',
        image_url: item.image_url || '',
        website_url: item.website_url || '',
        contact_phone: item.contact_phone || '',
        is_featured: Boolean(item.is_featured),
      });
    } else {
      setForm({
        transport_type: item.transport_type || 'sgr',
        provider: item.provider || '',
        origin: item.origin || '',
        destination: item.destination || '',
        estimated_fare: item.estimated_fare || '',
        duration_minutes: item.duration_minutes ?? '',
        departure_time: item.departure_time || '',
        arrival_time: item.arrival_time || '',
        booking_url: item.booking_url || '',
        image_url: item.image_url || '',
        notes: item.notes || '',
        is_active: Boolean(item.is_active),
      });
    }

    setNotice('');
    setError('');
  }

  async function saveForm(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setNotice('');

    const type = formType;
    const collection = {
      destination: 'destinations',
      accommodation: 'accommodations',
      transport: 'transport',
    }[type];

    const payload = { ...form };

    if (type === 'accommodation') {
      payload.destination_id = Number(payload.destination_id);
      payload.estimated_nightly_rate =
        payload.estimated_nightly_rate === ''
          ? null : Number(payload.estimated_nightly_rate);
    } else if (type === 'destination') {
      payload.estimated_daily_cost =
        payload.estimated_daily_cost === ''
          ? null : Number(payload.estimated_daily_cost);
    } else {
      payload.estimated_fare =
        payload.estimated_fare === ''
          ? null : Number(payload.estimated_fare);
      payload.duration_minutes =
        payload.duration_minutes === ''
          ? null : Number(payload.duration_minutes);
    }

    try {
      await request(
        `/admin/${collection}${editingId ? `/${editingId}` : ''}`,
        {
          method: editingId ? 'PATCH' : 'POST',
          body: JSON.stringify(payload),
        },
      );

      setFormType('');
      setEditingId(null);
      const label = {
        destination: 'Destination',
        accommodation: 'Accommodation',
        transport: 'Transport option',
      }[type];

      setNotice(
        `${label} ${editingId ? 'updated' : 'created'} successfully.`,
      );
      await loadDashboard();
    } catch (err) {
      setError(err.message || 'Unable to save this listing.');
    } finally {
      setSaving(false);
    }
  }

  async function deleteListing(type, item) {
    const confirmed = window.confirm(
      `Delete "${item.name}"? This action cannot be undone.`,
    );

    if (!confirmed) return;

    const collection = type === 'destination' ? 'destinations' : 'accommodations';

    setError('');
    setNotice('');

    try {
      await request(`/admin/${collection}/${item.id}`, {
        method: 'DELETE',
      });

      setNotice(`${item.name} was deleted.`);
      await loadDashboard();
    } catch (err) {
      setError(err.message || 'Unable to delete this listing.');
    }
  }

  async function toggleTransport(item) {
    setError('');
    setNotice('');

    try {
      await request(`/admin/transport/${item.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ is_active: !item.is_active }),
      });

      setNotice(
        `${item.provider} was ${item.is_active ? 'deactivated' : 'activated'}.`,
      );
      await loadDashboard();
    } catch (err) {
      setError(err.message || 'Unable to update this transport option.');
    }
  }

  async function toggleUser(user) {
    setError('');
    setNotice('');

    try {
      await request(`/admin/users/${user.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ is_active: !user.is_active }),
      });

      setNotice(`${user.full_name}'s account was updated.`);
      await loadDashboard();
    } catch (err) {
      setError(err.message || 'Unable to update this account.');
    }
  }

  const cards = [
    { label: 'Registered users', value: statistics.users ?? 0, icon: '♧' },
    { label: 'Destinations', value: statistics.destinations ?? 0, icon: '⌖' },
    { label: 'Accommodations', value: statistics.accommodations ?? 0, icon: '⌂' },
    { label: 'Transport options', value: transportOptions.length, icon: '↗' },
    { label: 'Saved itineraries', value: statistics.itineraries ?? 0, icon: '▤' },
  ];

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <a className="admin-brand" href="/admin">
          <span className="admin-brand__mark">⌖</span>
          <span>
            safari<span>planner</span>
            <small>ADMINISTRATION</small>
          </span>
        </a>

        <p className="admin-sidebar__label">WORKSPACE</p>

        <nav className="admin-sidebar__nav" aria-label="Admin navigation">
          {sections.map((item) => (
            <button
              key={item.id}
              type="button"
              className={section === item.id ? 'is-active' : ''}
              onClick={() => {
                setSection(item.id);
                setFormType('');
                setError('');
                setNotice('');
              }}
            >
              <span>{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>

        <div className="admin-sidebar__bottom">
          <span>KENYA · TRAVEL MANAGEMENT</span>
          <button type="button" onClick={onLogout}>
            Sign out ↗
          </button>
        </div>
      </aside>

      <main className="admin-main">
        <header className="admin-topbar">
          <div>
            <span className="admin-eyebrow">SAFARI PLANNER / ADMIN</span>
            <h1>
              {sections.find((item) => item.id === section)?.label}
            </h1>
          </div>
          <span className="admin-account">Administrator</span>
        </header>

        <section className="admin-content">
          {error && <p className="admin-message admin-message--error" role="alert">{error}</p>}
          {notice && <p className="admin-message admin-message--success" role="status">{notice}</p>}

          {loading ? (
            <p className="admin-loading" role="status">Loading your dashboard...</p>
          ) : (
            <>
              {section === 'overview' && (
                <>
                  <div className="admin-welcome">
                    <div>
                      <span className="admin-eyebrow">YOUR PLATFORM AT A GLANCE</span>
                      <h2>Manage journeys across Kenya.</h2>
                      <p>Keep destinations, stays and traveller accounts organised in one place.</p>
                    </div>
                    <span className="admin-welcome__symbol">⌖</span>
                  </div>

                  <div className="admin-stat-grid">
                    {cards.map((card) => (
                      <article className="admin-stat-card" key={card.label}>
                        <span>{card.icon}</span>
                        <p>{card.label}</p>
                        <strong>{card.value.toLocaleString('en-KE')}</strong>
                      </article>
                    ))}
                  </div>

                  <div className="admin-overview-grid">
                    <article className="admin-panel">
                      <span className="admin-eyebrow">PLATFORM ACTIVITY</span>
                      <h3>Account overview</h3>
                      <div className="admin-overview-row">
                        <span>Active accounts</span>
                        <strong>{statistics.active_users ?? 0}</strong>
                      </div>
                      <div className="admin-overview-row">
                        <span>Inactive accounts</span>
                        <strong>{Math.max(0, (statistics.users || 0) - (statistics.active_users || 0))}</strong>
                      </div>
                    </article>

                    <article className="admin-panel admin-quick-actions">
                      <span className="admin-eyebrow">QUICK ACTIONS</span>
                      <h3>Manage your listings</h3>
                      <button type="button" onClick={() => openCreate('destination')}>
                        + Add a destination
                      </button>
                      <button type="button" onClick={() => openCreate('accommodation')}>
                        + Add accommodation
                      </button>
                      <button type="button" onClick={() => openCreate('transport')}>
                        + Add transport option
                      </button>
                    </article>
                  </div>
                </>
              )}

              {section === 'destinations' && (
                <div className="admin-panel">
                  <div className="admin-section-heading">
                    <div>
                      <span className="admin-eyebrow">KENYA DESTINATION DIRECTORY</span>
                      <h2>Destinations</h2>
                      <p>{destinations.length} destination listings</p>
                    </div>
                    <button className="admin-primary-button" onClick={() => openCreate('destination')}>
                      + Add destination
                    </button>
                  </div>

                  <div className="admin-table-wrap">
                    <table className="admin-table">
                      <thead>
                        <tr><th>Destination</th><th>Region</th><th>Category</th><th>Daily estimate</th><th>Actions</th></tr>
                      </thead>
                      <tbody>
                        {destinations.map((item) => (
                          <tr key={item.id}>
                            <td><strong>{item.name}</strong><small>{item.country}</small></td>
                            <td>{item.region || '—'}</td>
                            <td>{item.category || '—'}</td>
                            <td>{item.estimated_daily_cost ? `KES ${Number(item.estimated_daily_cost).toLocaleString('en-KE')}` : 'Not set'}</td>
                            <td className="admin-actions">
                              <button onClick={() => openEdit('destination', item)}>Edit</button>
                              <button className="is-danger" onClick={() => deleteListing('destination', item)}>Delete</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {destinations.length === 0 && <p className="admin-empty">No destinations have been added yet.</p>}
                  </div>
                </div>
              )}

              {section === 'accommodations' && (
                <div className="admin-panel">
                  <div className="admin-section-heading">
                    <div>
                      <span className="admin-eyebrow">PROPERTY DIRECTORY</span>
                      <h2>Accommodations</h2>
                      <p>{accommodations.length} property listings</p>
                    </div>
                    <button className="admin-primary-button" onClick={() => openCreate('accommodation')}>
                      + Add accommodation
                    </button>
                  </div>

                  <div className="admin-table-wrap">
                    <table className="admin-table">
                      <thead>
                        <tr><th>Property</th><th>Destination</th><th>Type</th><th>Nightly estimate</th><th>Actions</th></tr>
                      </thead>
                      <tbody>
                        {accommodations.map((item) => (
                          <tr key={item.id}>
                            <td><strong>{item.name}</strong><small>{item.location || 'Kenya'}</small></td>
                            <td>{item.destination}</td>
                            <td>{item.accommodation_type}</td>
                            <td>{item.estimated_nightly_rate ? `KES ${Number(item.estimated_nightly_rate).toLocaleString('en-KE')}` : 'Contact provider'}</td>
                            <td className="admin-actions">
                              <button onClick={() => openEdit('accommodation', item)}>Edit</button>
                              <button className="is-danger" onClick={() => deleteListing('accommodation', item)}>Delete</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {accommodations.length === 0 && <p className="admin-empty">No accommodation listings yet.</p>}
                  </div>
                </div>
              )}

              {section === 'transport' && (
                <div className="admin-panel">
                  <div className="admin-section-heading">
                    <div>
                      <span className="admin-eyebrow">KENYA TRANSPORT DIRECTORY</span>
                      <h2>Transport options</h2>
                      <p>{transportOptions.length} transport listings · Indicative fares in KES</p>
                    </div>
                    <button
                      className="admin-primary-button"
                      onClick={() => openCreate('transport')}
                    >
                      + Add transport option
                    </button>
                  </div>

                  <div className="admin-table-wrap">
                    <table className="admin-table">
                      <thead>
                        <tr>
                          <th>Provider</th>
                          <th>Type</th>
                          <th>Route</th>
                          <th>Indicative fare</th>
                          <th>Duration</th>
                          <th>Status</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {transportOptions.map((item) => (
                          <tr key={item.id}>
                            <td><strong>{item.provider}</strong></td>
                            <td>{item.transport_type.toUpperCase()}</td>
                            <td>{item.origin} → {item.destination}</td>
                            <td>
                              {item.estimated_fare == null
                                ? 'Not provided'
                                : `KES ${Number(item.estimated_fare).toLocaleString('en-KE')}`}
                            </td>
                            <td>{item.duration_minutes ? `${item.duration_minutes} min` : 'Not set'}</td>
                            <td>
                              <span className={`admin-status ${item.is_active ? 'is-active' : 'is-inactive'}`}>
                                {item.is_active ? 'Active' : 'Inactive'}
                              </span>
                            </td>
                            <td className="admin-actions">
                              <button onClick={() => openEdit('transport', item)}>Edit</button>
                              <button
                                className={item.is_active ? 'is-danger' : ''}
                                onClick={() => toggleTransport(item)}
                              >
                                {item.is_active ? 'Deactivate' : 'Activate'}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {transportOptions.length === 0 && (
                      <p className="admin-empty">No transport options have been added yet.</p>
                    )}
                  </div>
                  <p className="admin-empty">
                    Fares and journey durations are estimates and should be confirmed with providers.
                  </p>
                </div>
              )}

              {section === 'users' && (
                <div className="admin-panel">
                  <div className="admin-section-heading">
                    <div>
                      <span className="admin-eyebrow">ACCOUNT DIRECTORY</span>
                      <h2>Users</h2>
                      <p>{users.length} registered accounts</p>
                    </div>
                  </div>

                  <div className="admin-table-wrap">
                    <table className="admin-table">
                      <thead>
                        <tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Action</th></tr>
                      </thead>
                      <tbody>
                        {users.map((user) => (
                          <tr key={user.id}>
                            <td><strong>{user.full_name}</strong></td>
                            <td>{user.email}</td>
                            <td>{user.role}</td>
                            <td><span className={`admin-status ${user.is_active ? 'is-active' : 'is-inactive'}`}>{user.is_active ? 'Active' : 'Inactive'}</span></td>
                            <td>
                              {user.role === 'admin' ? (
                                <span className="admin-protected">Protected</span>
                              ) : (
                                <button className="admin-user-action" onClick={() => toggleUser(user)}>
                                  {user.is_active ? 'Deactivate' : 'Activate'}
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {users.length === 0 && <p className="admin-empty">No user accounts found.</p>}
                  </div>
                </div>
              )}
            </>
          )}

          {formType && (
            <div className="admin-modal-backdrop" role="presentation">
              <section className="admin-form-panel" role="dialog" aria-modal="true" aria-labelledby="admin-form-title">
                <div className="admin-section-heading">
                  <div>
                    <span className="admin-eyebrow">{editingId ? 'UPDATE LISTING' : 'NEW LISTING'}</span>
                    <h2 id="admin-form-title">
                      {editingId ? 'Edit' : 'Add'} {formType}
                    </h2>
                  </div>
                  <button type="button" className="admin-close" onClick={() => setFormType('')} aria-label="Close form">×</button>
                </div>

                <form onSubmit={saveForm} className="admin-form">
                  {formType === 'destination' ? (
                    <>
                      <label>Destination name<input required maxLength="150" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
                      <label>County / Region<input maxLength="120" value={form.region} onChange={(e) => setForm({ ...form, region: e.target.value })} /></label>
                      <label>Category<input maxLength="80" placeholder="e.g. Wildlife & Safari" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} /></label>
                      <label>Description<textarea rows="3" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></label>
                      <label>Image URL<input type="url" value={form.image_url} onChange={(e) => setForm({ ...form, image_url: e.target.value })} /></label>
                      <label>Estimated daily cost (KES)<input type="number" min="0" step="0.01" value={form.estimated_daily_cost} onChange={(e) => setForm({ ...form, estimated_daily_cost: e.target.value })} /></label>
                    </>
                  ) : formType === 'accommodation' ? (
                    <>
                      <label>Property name<input required maxLength="180" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
                      <label>Destination<select required value={form.destination_id} onChange={(e) => setForm({ ...form, destination_id: e.target.value })}>{destinations.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
                      <label>Accommodation type<input required maxLength="60" placeholder="Hotel, lodge, camp..." value={form.accommodation_type} onChange={(e) => setForm({ ...form, accommodation_type: e.target.value })} /></label>
                      <label>Location<input maxLength="180" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} /></label>
                      <label>Description<textarea rows="3" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></label>
                      <label>Estimated nightly rate (KES)<input type="number" min="0" step="0.01" value={form.estimated_nightly_rate} onChange={(e) => setForm({ ...form, estimated_nightly_rate: e.target.value })} /></label>
                      <label>Property image URL<input type="url" value={form.image_url} onChange={(e) => setForm({ ...form, image_url: e.target.value })} /></label>
                      <label>Website URL<input type="url" value={form.website_url} onChange={(e) => setForm({ ...form, website_url: e.target.value })} /></label>
                      <label>Contact phone<input maxLength="40" value={form.contact_phone} onChange={(e) => setForm({ ...form, contact_phone: e.target.value })} /></label>
                    </>
                  ) : (
                    <>
                      <label>Transport type
                        <select required value={form.transport_type} onChange={(e) => setForm({ ...form, transport_type: e.target.value })}>
                          <option value="flight">Flight</option>
                          <option value="bus">Bus</option>
                          <option value="sgr">SGR</option>
                        </select>
                      </label>
                      <label>Provider<input required maxLength="150" value={form.provider} onChange={(e) => setForm({ ...form, provider: e.target.value })} /></label>
                      <label>Origin<input required maxLength="150" value={form.origin} onChange={(e) => setForm({ ...form, origin: e.target.value })} /></label>
                      <label>Destination<input required maxLength="150" value={form.destination} onChange={(e) => setForm({ ...form, destination: e.target.value })} /></label>
                      <label>Estimated fare (KES)<input type="number" min="0" step="0.01" placeholder="Leave blank if unpublished" value={form.estimated_fare} onChange={(e) => setForm({ ...form, estimated_fare: e.target.value })} /></label>
                      <label>Estimated duration (minutes)<input type="number" min="1" step="1" value={form.duration_minutes} onChange={(e) => setForm({ ...form, duration_minutes: e.target.value })} /></label>
                      <label>Departure time<input maxLength="20" placeholder="e.g. 08:00" value={form.departure_time} onChange={(e) => setForm({ ...form, departure_time: e.target.value })} /></label>
                      <label>Arrival time<input maxLength="20" placeholder="e.g. 13:00" value={form.arrival_time} onChange={(e) => setForm({ ...form, arrival_time: e.target.value })} /></label>
                      <label>Official booking URL<input type="url" required={form.is_active} placeholder="https://..." value={form.booking_url} onChange={(e) => setForm({ ...form, booking_url: e.target.value })} /></label>
                      <label>Provider vehicle image URL<input type="url" placeholder="https://..." value={form.image_url} onChange={(e) => setForm({ ...form, image_url: e.target.value })} /></label>
                      <label>Notes<textarea rows="3" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></label>
                      <label className="admin-checkbox">
                        <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} />
                        Make this option visible to travellers
                      </label>
                    </>
                  )}

                  {formType !== 'transport' && (
                    <label className="admin-checkbox">
                      <input type="checkbox" checked={form.is_featured} onChange={(e) => setForm({ ...form, is_featured: e.target.checked })} />
                      Feature this listing
                    </label>
                  )}

                  <div className="admin-form-actions">
                    <button type="button" className="admin-secondary-button" onClick={() => setFormType('')}>Cancel</button>
                    <button type="submit" className="admin-primary-button" disabled={saving}>
                      {saving ? 'Saving...' : editingId ? 'Save changes' : 'Create listing'}
                    </button>
                  </div>
                </form>
              </section>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

export default AdminDashboard;
