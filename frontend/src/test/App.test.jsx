import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import App from '../App';

const API = 'http://127.0.0.1:5000/api';

function mockResponse(data, ok = true) {
  return {
    ok,
    json: async () => data,
  };
}

function renderApp(route = '/plan-trip') {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <App />
    </MemoryRouter>
  );
}

async function fillTripForm() {
  const user = userEvent.setup();

  await user.type(
    screen.getByRole('textbox', { name: /destination/i }),
    'Maasai Mara'
  );

  fireEvent.change(screen.getByLabelText(/start date/i), {
    target: { value: '2030-06-10' },
  });

  fireEvent.change(screen.getByLabelText(/end date/i), {
    target: { value: '2030-06-14' },
  });

  await user.selectOptions(
    screen.getByLabelText(/what kind of journey/i),
    'Wildlife & Safari'
  );

  await user.type(
    screen.getByLabelText(/approximate budget/i),
    '50000'
  );

  return user;
}

describe('App trip planning', () => {
  beforeEach(() => {
    sessionStorage.clear();
    window.scrollTo = vi.fn();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('renders the trip planning form', async () => {
    global.fetch = vi.fn().mockResolvedValue(
      mockResponse({ destinations: [] })
    );

    renderApp();

    expect(
      screen.getByRole('heading', { name: /where will yourstory take you/i })
    ).toBeInTheDocument();

    expect(screen.getByLabelText(/destination/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/start date/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/end date/i)).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /generate my itinerary/i })
    ).toBeInTheDocument();

    await waitFor(() => {
      expect(
        screen.queryByText(/discovering destinations/i)
      ).not.toBeInTheDocument();
    });
  });

  it('rejects an end date earlier than the start date', async () => {
    global.fetch = vi.fn().mockResolvedValue(
      mockResponse({ destinations: [] })
    );

    renderApp();

    await fillTripForm();

    fireEvent.change(screen.getByLabelText(/end date/i), {
      target: { value: '2030-06-05' },
    });

    fireEvent.submit(
      screen.getByRole('button', { name: /generate my itinerary/i }).closest('form')
    );

    expect(
      await screen.findByText(/the end date cannot be before the start date/i)
    ).toBeInTheDocument();

    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('saves guest preferences and sends the guest token to generate an itinerary', async () => {
    const guestToken = 'test-guest-access-token';

    global.fetch = vi.fn().mockImplementation((url, options = {}) => {
      if (url === `${API}/destinations`) {
        return Promise.resolve(mockResponse({ destinations: [] }));
      }

      if (url === `${API}/trip-preferences`) {
        return Promise.resolve(
          mockResponse({
            preference: {
              id: 25,
              destination: 'Maasai Mara',
              travel_style: 'Wildlife & Safari',
            },
            guest_access_token: guestToken,
          })
        );
      }

      if (url === `${API}/trip-preferences/25/generate`) {
        return Promise.resolve(
          mockResponse({
            itinerary_id: 42,
            plan: {
              destination: 'Maasai Mara',
              duration_days: 5,
              start_date: '2030-06-10',
              end_date: '2030-06-14',
              budget_kes: 50000,
              destination_details: { region: 'Narok' },
              days: [
                {
                  day: 1,
                  date: '2030-06-10',
                  activities: [
                    {
                      time: 'Morning',
                      title: 'Safari drive',
                      description: 'Explore the reserve.',
                    },
                  ],
                },
              ],
              notice: 'Your itinerary is ready.',
            },
          })
        );
      }

      throw new Error(`Unexpected API request: ${url}`);
    });

    renderApp();

    const user = await fillTripForm();

    await user.click(
      screen.getByRole('button', { name: /generate my itinerary/i })
    );

    expect(
      await screen.findByText(/your itinerary has been generated/i)
    ).toBeInTheDocument();

    expect(
      screen.getByRole('heading', { name: /your 5-day itinerary/i })
    ).toBeInTheDocument();

    expect(screen.getByText('Safari drive')).toBeInTheDocument();

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        `${API}/trip-preferences/25/generate`,
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'X-Guest-Access-Token': guestToken,
          }),
        })
      );
    });

    expect(
      sessionStorage.getItem('safari_planner_guest_access_token')
    ).toBe(guestToken);

    const saveCall = global.fetch.mock.calls.find(
      ([url]) => url === `${API}/trip-preferences`
    );

    expect(JSON.parse(saveCall[1].body)).toEqual({
      destination: 'Maasai Mara',
      start_date: '2030-06-10',
      end_date: '2030-06-14',
      travel_style: 'Wildlife & Safari',
      budget: 50000,
    });
  });

  it('displays an API error when trip preferences cannot be saved', async () => {
    global.fetch = vi.fn().mockImplementation((url) => {
      if (url === `${API}/destinations`) {
        return Promise.resolve(mockResponse({ destinations: [] }));
      }

      if (url === `${API}/trip-preferences`) {
        return Promise.resolve(
          mockResponse({ error: 'Destination is not supported.' }, false)
        );
      }

      throw new Error(`Unexpected API request: ${url}`);
    });

    renderApp();

    const user = await fillTripForm();

    await user.click(
      screen.getByRole('button', { name: /generate my itinerary/i })
    );

    expect(
      await screen.findByText(/destination is not supported/i)
    ).toBeInTheDocument();

    expect(
      screen.queryByText(/your itinerary has been generated/i)
    ).not.toBeInTheDocument();
  });

  it('reports when preferences are saved but itinerary generation fails', async () => {
    global.fetch = vi.fn().mockImplementation((url) => {
      if (url === `${API}/destinations`) {
        return Promise.resolve(mockResponse({ destinations: [] }));
      }

      if (url === `${API}/trip-preferences`) {
        return Promise.resolve(
          mockResponse({
            preference: {
              id: 30,
              destination: 'Maasai Mara',
              travel_style: 'Wildlife & Safari',
            },
            guest_access_token: 'another-guest-token',
          })
        );
      }

      if (url === `${API}/trip-preferences/30/generate`) {
        return Promise.resolve(
          mockResponse({ error: 'Itinerary generation failed.' }, false)
        );
      }

      throw new Error(`Unexpected API request: ${url}`);
    });

    renderApp();

    const user = await fillTripForm();

    await user.click(
      screen.getByRole('button', { name: /generate my itinerary/i })
    );

    expect(
      await screen.findByText(/your preferences were saved, but itinerary generation failed/i)
    ).toBeInTheDocument();

    expect(
      screen.getByText(/itinerary generation failed/i)
    ).toBeInTheDocument();
  });
});

describe('App saved trips', () => {
  const token = 'test-user-jwt';

  const itineraries = [
    {
      itinerary_id: 71,
      destination: 'Maasai Mara',
      start_date: '2030-06-10',
      end_date: '2030-06-14',
      duration_days: 5,
      travel_style: 'Wildlife & Safari',
      budget_kes: 50000,
      destination_details: {
        region: 'Narok',
        country: 'Kenya',
      },
    },
    {
      itinerary_id: 72,
      destination: 'Lamu Old Town',
      start_date: '2020-06-10',
      end_date: '2020-06-14',
      duration_days: 5,
      travel_style: 'Culture & Heritage',
      budget_kes: 30000,
      destination_details: {
        region: 'Coast',
        country: 'Kenya',
      },
    },
  ];

  function setupAuthenticatedApp() {
    sessionStorage.setItem('safari_planner_token', token);

    global.fetch = vi.fn().mockImplementation((url) => {
      if (url === `${API}/destinations`) {
        return Promise.resolve(mockResponse({ destinations: [] }));
      }

      if (url === `${API}/auth/me`) {
        return Promise.resolve(
          mockResponse({
            user: {
              id: 4,
              full_name: 'Test Traveler',
              email: 'traveler@example.com',
            },
          })
        );
      }

      if (url === `${API}/itineraries`) {
        return Promise.resolve(mockResponse({ itineraries }));
      }

      throw new Error(`Unexpected API request: ${url}`);
    });

    return renderApp('/my-trips');
  }

  const detailItinerary = {
    itinerary_id: 71,
    trip_preference_id: 25,
    plan: {
      destination: "Maasai Mara",
      start_date: "2030-06-10",
      end_date: "2030-06-14",
      duration_days: 5,
      travel_style: "Wildlife & Safari",
      budget_kes: 50000,
      destination_details: {
        region: "Narok",
        country: "Kenya",
      },
      days: [
        {
          day: 1,
          date: "2030-06-10",
          activities: [
            {
              time: "Morning",
              title: "Safari drive",
              description: "Explore the reserve.",
            },
          ],
        },
      ],
    },
  };

  beforeEach(() => {
    sessionStorage.clear();
    window.scrollTo = vi.fn();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('loads a saved itinerary when its detail URL is opened directly', async () => {
    global.fetch = vi.fn().mockImplementation((url) => {
      if (url === `${API}/destinations`) {
        return Promise.resolve(mockResponse({ destinations: [] }));
      }

      if (url === `${API}/auth/me`) {
        return Promise.resolve(
          mockResponse({
            user: {
              id: 4,
              full_name: 'Test Traveler',
              email: 'traveler@example.com',
            },
          })
        );
      }

      if (url === `${API}/itineraries`) {
        return Promise.resolve(mockResponse({ itineraries }));
      }

      if (url === `${API}/itineraries/71`) {
        return Promise.resolve(mockResponse(detailItinerary));
      }

      throw new Error(`Unexpected API request: ${url}`);
    });

    sessionStorage.setItem('safari_planner_token', token);
    renderApp('/my-trips/71');

    expect(await screen.findByText('Safari drive')).toBeInTheDocument();

    expect(global.fetch).toHaveBeenCalledWith(
      `${API}/itineraries/71`,
      expect.objectContaining({
        headers: { Authorization: `Bearer ${token}` },
      })
    );
  });

  it('rejects an invalid date range when editing a saved itinerary', async () => {
    global.fetch = vi.fn().mockImplementation((url) => {
      if (url === `${API}/destinations`) {
        return Promise.resolve(mockResponse({ destinations: [] }));
      }

      if (url === `${API}/auth/me`) {
        return Promise.resolve(
          mockResponse({
            user: {
              id: 4,
              full_name: 'Test Traveler',
              email: 'traveler@example.com',
            },
          })
        );
      }

      if (url === `${API}/itineraries`) {
        return Promise.resolve(mockResponse({ itineraries }));
      }

      if (url === `${API}/itineraries/71`) {
        return Promise.resolve(mockResponse(detailItinerary));
      }

      throw new Error(`Unexpected API request: ${url}`);
    });

    sessionStorage.setItem('safari_planner_token', token);
    renderApp('/my-trips/71');

    await screen.findByText('Safari drive');

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /edit trip/i }));

    fireEvent.change(screen.getAllByLabelText(/end date/i)[1], {
      target: { value: '2030-06-05' },
    });

    fireEvent.submit(
      screen.getByRole('button', { name: /save changes/i }).closest('form')
    );

    expect(
      await screen.findByText(/the end date cannot be before the start date/i)
    ).toBeInTheDocument();

    expect(
      global.fetch.mock.calls.some(
        ([url, options = {}]) =>
          url === `${API}/trip-preferences/25` &&
          options.method === 'PUT'
      )
    ).toBe(false);
  });

  it('updates a saved itinerary and refreshes its detail and saved-trip list', async () => {
    const updatedDetail = {
      ...detailItinerary,
      plan: {
        ...detailItinerary.plan,
        end_date: '2030-06-15',
        duration_days: 6,
      },
    };

    const updatedList = [
      {
        ...itineraries[0],
        end_date: '2030-06-15',
        duration_days: 6,
      },
      itineraries[1],
    ];

    let detailRequestCount = 0;
    let listRequestCount = 0;

    global.fetch = vi.fn().mockImplementation((url, options = {}) => {
      if (url === `${API}/destinations`) {
        return Promise.resolve(mockResponse({ destinations: [] }));
      }

      if (url === `${API}/auth/me`) {
        return Promise.resolve(
          mockResponse({
            user: {
              id: 4,
              full_name: 'Test Traveler',
              email: 'traveler@example.com',
            },
          })
        );
      }

      if (url === `${API}/itineraries`) {
        listRequestCount += 1;

        return Promise.resolve(
          mockResponse({
            itineraries: listRequestCount > 1 ? updatedList : itineraries,
          })
        );
      }

      if (url === `${API}/itineraries/71` && (!options.method || options.method === 'GET')) {
        detailRequestCount += 1;

        return Promise.resolve(
          mockResponse(
            detailRequestCount > 1 ? updatedDetail : detailItinerary
          )
        );
      }

      if (
        url === `${API}/trip-preferences/25` &&
        options.method === 'PUT'
      ) {
        return Promise.resolve(
          mockResponse({ message: 'Trip preferences updated.' })
        );
      }

      throw new Error(`Unexpected API request: ${url}`);
    });

    sessionStorage.setItem('safari_planner_token', token);
    renderApp('/my-trips/71');

    await screen.findByText('Safari drive');

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /edit trip/i }));

    fireEvent.change(screen.getAllByLabelText(/end date/i)[1], {
      target: { value: '2030-06-15' },
    });

    await user.click(screen.getByRole('button', { name: /save changes/i }));

    expect(
      await screen.findByText(/your trip and itinerary have been updated/i)
    ).toBeInTheDocument();

    await waitFor(() => {
      expect(detailRequestCount).toBeGreaterThanOrEqual(2);
      expect(listRequestCount).toBeGreaterThanOrEqual(2);
    });

    const updateCall = global.fetch.mock.calls.find(
      ([url, options = {}]) =>
        url === `${API}/trip-preferences/25` &&
        options.method === 'PUT'
    );

    expect(updateCall).toBeDefined();
    expect(updateCall[1].headers).toEqual(
      expect.objectContaining({
        Authorization: `Bearer ${token}`,
      })
    );
    expect(JSON.parse(updateCall[1].body)).toEqual({
      destination: 'Maasai Mara',
      start_date: '2030-06-10',
      end_date: '2030-06-15',
      travel_style: 'Wildlife & Safari',
      budget: 50000,
    });
  });

  it('loads only the authenticated user’s saved itineraries', async () => {
    setupAuthenticatedApp();

    expect(
      await screen.findByRole('heading', { name: /maasai mara/i })
    ).toBeInTheDocument();

    expect(
      screen.getByRole('heading', { name: /lamu old town/i })
    ).toBeInTheDocument();

    expect(global.fetch).toHaveBeenCalledWith(
      `${API}/itineraries`,
      expect.objectContaining({
        headers: { Authorization: `Bearer ${token}` },
      })
    );
  });

  it('searches and filters saved trips', async () => {
    setupAuthenticatedApp();

    expect(
      await screen.findByRole('heading', { name: /maasai mara/i })
    ).toBeInTheDocument();

    const user = userEvent.setup();

    await user.type(
      screen.getByRole('searchbox', { name: /search saved trips/i }),
      'Lamu'
    );

    expect(
      screen.getByRole('heading', { name: /lamu old town/i })
    ).toBeInTheDocument();

    expect(
      screen.queryByRole('heading', { name: /maasai mara/i })
    ).not.toBeInTheDocument();

    await user.clear(
      screen.getByRole('searchbox', { name: /search saved trips/i })
    );

    await user.click(screen.getByRole('button', { name: 'Upcoming' }));

    expect(
      screen.getByRole('heading', { name: /maasai mara/i })
    ).toBeInTheDocument();

    expect(
      screen.queryByRole('heading', { name: /lamu old town/i })
    ).not.toBeInTheDocument();
  });

  it('deletes a saved itinerary using the authenticated user token', async () => {
    setupAuthenticatedApp();
    window.confirm = vi.fn(() => true);

    expect(
      await screen.findByRole('heading', { name: /maasai mara/i })
    ).toBeInTheDocument();

    global.fetch.mockImplementation((url, options = {}) => {
      if (url === `${API}/destinations`) {
        return Promise.resolve(mockResponse({ destinations: [] }));
      }

      if (url === `${API}/auth/me`) {
        return Promise.resolve(
          mockResponse({
            user: {
              id: 4,
              full_name: 'Test Traveler',
              email: 'traveler@example.com',
            },
          })
        );
      }

      if (url === `${API}/itineraries`) {
        return Promise.resolve(mockResponse({ itineraries }));
      }

      if (url === `${API}/itineraries/71` && options.method === 'DELETE') {
        return Promise.resolve(mockResponse({ message: 'Deleted.' }));
      }

      throw new Error(`Unexpected API request: ${url}`);
    });

    const user = userEvent.setup();

    const deleteButtons = screen.getAllByRole('button', {
      name: /delete trip/i,
    });

    await user.click(deleteButtons[0]);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        `${API}/itineraries/71`,
        expect.objectContaining({
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        })
      );
    });

    await waitFor(() => {
      expect(
        screen.queryByRole('heading', { name: /maasai mara/i })
      ).not.toBeInTheDocument();
    });

    expect(window.confirm).toHaveBeenCalledTimes(1);
  });
});
