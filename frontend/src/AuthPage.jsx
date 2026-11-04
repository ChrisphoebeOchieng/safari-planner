import { Link } from 'react-router-dom';

export default function AuthPage({
  mode,
  setMode,
  form,
  setForm,
  onSubmit,
  loading,
  error,
}) {
  const isRegister = mode === 'register';

  function updateField(event) {
    setForm((previous) => ({
      ...previous,
      [event.target.name]: event.target.value,
    }));
  }

  return (
    <section className="auth-page section-shell">
      <div className="auth-page__content">
        <span className="eyebrow">
          <span className="eyebrow__line" />
          YOUR JOURNEY STARTS HERE
        </span>

        <h1>
          {isRegister ? 'Create your' : 'Welcome'} 
          <br />
          <em>{isRegister ? 'travel account.' : 'back.'}</em>
        </h1>

        <p>
          {isRegister
            ? 'Create an account to keep your travel plans and itineraries together.'
            : 'Sign in to revisit your saved journeys and continue planning.'}
        </p>

        <form className="auth-form" onSubmit={onSubmit}>
          {isRegister && (
            <label>
              Full name
              <input
                name="full_name"
                type="text"
                autoComplete="name"
                value={form.full_name}
                onChange={updateField}
                placeholder="Your full name"
                maxLength={120}
                required
              />
            </label>
          )}

          <label>
            Email address
            <input
              name="email"
              type="email"
              autoComplete="email"
              value={form.email}
              onChange={updateField}
              placeholder="you@example.com"
              required
            />
          </label>

          <label>
            Password
            <input
              name="password"
              type="password"
              autoComplete={isRegister ? 'new-password' : 'current-password'}
              value={form.password}
              onChange={updateField}
              placeholder={isRegister ? 'At least 8 characters' : 'Your password'}
              minLength={isRegister ? 8 : undefined}
              required
            />
          </label>

          {error && (
            <p className="auth-form__error" role="alert">
              {error}
            </p>
          )}

          <button
            className="button button--gold auth-form__submit"
            type="submit"
            disabled={loading}
          >
            {loading
              ? 'Please wait...'
              : isRegister
                ? 'Create account'
                : 'Sign in'}
          </button>
        </form>

        <p className="auth-page__switch">
          {isRegister ? 'Already have an account?' : 'New to Safari Planner?'}
          {' '}
          <button
            type="button"
            onClick={() => setMode(isRegister ? 'login' : 'register')}
          >
            {isRegister ? 'Sign in' : 'Create an account'}
          </button>
        </p>

        <Link className="text-link auth-page__guest" to="/">
          Continue exploring <span aria-hidden="true">→</span>
        </Link>
      </div>
    </section>
  );
}
