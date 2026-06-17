import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useStatus } from '../hooks/useStatus';
import { Status } from './Status';

type AuthMode = 'signIn' | 'signUp';

const authErrorMessage = (code: string): string => {
  switch (code) {
    case 'auth/invalid-email':
      return 'Please enter a valid email address.';
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'Incorrect email or password.';
    case 'auth/email-already-in-use':
      return 'An account with this email already exists. Try signing in.';
    case 'auth/weak-password':
      return 'Password should be at least 6 characters.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Please wait a moment and try again.';
    default:
      return 'Could not sign in. Please try again.';
  }
};

export const AuthPage: React.FC = () => {
  const { signIn, signUp } = useAuth();
  const { status, showError, showSuccess, hideStatus } = useStatus();
  const [mode, setMode] = useState<AuthMode>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    hideStatus();

    if (!email.trim() || !password) {
      showError('Please enter your email and password.');
      return;
    }

    if (mode === 'signUp' && password !== confirmPassword) {
      showError('Passwords do not match.');
      return;
    }

    setIsSubmitting(true);
    try {
      if (mode === 'signIn') {
        await signIn(email, password);
        showSuccess('Signed in successfully');
      } else {
        await signUp(email, password);
        showSuccess('Account created — you are now signed in');
      }
    } catch (error) {
      const code = (error as { code?: string })?.code ?? '';
      showError(authErrorMessage(code));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1>Music Learner Profiles</h1>
        <p className="auth-subtitle">
          {mode === 'signIn'
            ? 'Sign in to access teacher sessions and tools.'
            : 'Create an account to get started.'}
        </p>

        <form className="auth-form" onSubmit={handleSubmit}>
          <label htmlFor="auth-email">Email</label>
          <input
            id="auth-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@school.org"
          />

          <label htmlFor="auth-password">Password</label>
          <div className="auth-password-field">
            <input
              id="auth-password"
              type={showPassword ? 'text' : 'password'}
              autoComplete={mode === 'signIn' ? 'current-password' : 'new-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 6 characters"
            />
            <button
              type="button"
              className="auth-password-toggle"
              onClick={() => setShowPassword((visible) => !visible)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? 'Hide' : 'Show'}
            </button>
          </div>

          {mode === 'signUp' && (
            <>
              <label htmlFor="auth-confirm-password">Confirm password</label>
              <div className="auth-password-field">
                <input
                  id="auth-confirm-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter your password"
                />
                <button
                  type="button"
                  className="auth-password-toggle"
                  onClick={() => setShowPassword((visible) => !visible)}
                  aria-label={showPassword ? 'Hide confirm password' : 'Show confirm password'}
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
            </>
          )}

          <button type="submit" className="btn-teacher auth-submit" disabled={isSubmitting}>
            {isSubmitting
              ? 'Please wait…'
              : mode === 'signIn'
                ? 'Sign in'
                : 'Create account'}
          </button>
        </form>

        <button
          type="button"
          className="auth-toggle"
          onClick={() => {
            hideStatus();
            setConfirmPassword('');
            setShowPassword(false);
            setMode(mode === 'signIn' ? 'signUp' : 'signIn');
          }}
        >
          {mode === 'signIn'
            ? 'Need an account? Create one'
            : 'Already have an account? Sign in'}
        </button>
      </div>

      <Status message={status.message} type={status.type} />
    </div>
  );
};
