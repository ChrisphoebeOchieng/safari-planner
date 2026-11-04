import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { useState } from 'react'
import AuthPage from '../AuthPage'

function AuthPageHarness({
  initialMode = 'login',
  loading = false,
  error = '',
  onSubmit = vi.fn(),
}) {
  const [mode, setMode] = useState(initialMode)
  const [form, setForm] = useState({
    full_name: '',
    email: '',
    password: '',
  })

  return (
    <MemoryRouter>
      <AuthPage
        mode={mode}
        setMode={setMode}
        form={form}
        setForm={setForm}
        onSubmit={onSubmit}
        loading={loading}
        error={error}
      />
    </MemoryRouter>
  )
}

describe('AuthPage', () => {
  it('renders the login form', () => {
    render(<AuthPageHarness />)

    expect(
      screen.getByRole('heading', { name: /welcomeback/i })
    ).toBeInTheDocument()

    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument()

    expect(
      screen.getByRole('button', { name: 'Sign in', exact: true })
    ).toBeInTheDocument()
  })

  it('does not show the full name field during login', () => {
    render(<AuthPageHarness />)

    expect(screen.queryByLabelText(/full name/i)).not.toBeInTheDocument()
  })

  it('switches from login to registration', () => {
    render(<AuthPageHarness />)

    fireEvent.click(
      screen.getByRole('button', { name: /create an account/i })
    )

    expect(
      screen.getByRole('heading', { name: /create yourtravel account/i })
    ).toBeInTheDocument()

    expect(screen.getByLabelText(/full name/i)).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Create account' })
    ).toBeInTheDocument()
  })

  it('switches from registration back to login', () => {
    render(<AuthPageHarness initialMode="register" />)

    fireEvent.click(
      screen.getByRole('button', { name: 'Sign in' })
    )

    expect(
      screen.getByRole('heading', { name: /welcomeback/i })
    ).toBeInTheDocument()
  })

  it('updates the email field', () => {
    render(<AuthPageHarness />)

    const emailInput = screen.getByLabelText(/email address/i)

    fireEvent.change(emailInput, {
      target: { value: 'traveler@example.com' },
    })

    expect(emailInput).toHaveValue('traveler@example.com')
  })

  it('updates the password field', () => {
    render(<AuthPageHarness />)

    const passwordInput = screen.getByLabelText(/password/i)

    fireEvent.change(passwordInput, {
      target: { value: 'StrongPass123' },
    })

    expect(passwordInput).toHaveValue('StrongPass123')
  })

  it('calls the submit handler when the form is submitted', () => {
    const handleSubmit = vi.fn((event) => event.preventDefault())

    render(<AuthPageHarness onSubmit={handleSubmit} />)

    fireEvent.submit(
      screen.getByRole('button', { name: 'Sign in' }).closest('form')
    )

    expect(handleSubmit).toHaveBeenCalledTimes(1)
  })

  it('displays authentication errors', () => {
    render(
      <AuthPageHarness error="Invalid email or password." />
    )

    expect(
      screen.getByRole('alert')
    ).toHaveTextContent('Invalid email or password.')
  })

  it('disables submission while loading', () => {
    render(<AuthPageHarness loading />)

    expect(
      screen.getByRole('button', { name: /please wait/i })
    ).toBeDisabled()
  })

  it('provides a link to continue exploring', () => {
    render(<AuthPageHarness />)

    expect(
      screen.getByRole('link', { name: /continue exploring/i })
    ).toHaveAttribute('href', '/')
  })
})
