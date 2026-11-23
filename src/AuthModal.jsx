import React, { useState } from 'react';
import {
  Eye,
  EyeOff,
  Lock,
  User,
  Phone,
  ArrowRight,
  UserPlus,
  LogIn,
  CheckCircle2,
  AlertCircle,
  Building2,
  Mail,
  KeyRound,
  Copy,
  Check
} from 'lucide-react';
import './AuthModal.css';

const USERS_STORAGE_KEY = 'buildpay-registered-users-v1';
const CURRENT_USER_KEY = 'buildpay-current-user-v1';

// Initial storage getter
export function getStoredUsers() {
  try {
    const raw = localStorage.getItem(USERS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function getCurrentUser() {
  try {
    const raw = localStorage.getItem(CURRENT_USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setCurrentUser(user) {
  try {
    if (user) {
      localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(CURRENT_USER_KEY);
    }
  } catch {}
}

export default function AuthModal({ onLoginSuccess }) {
  // Mode: 'login' | 'signup' | 'forgot'
  const [mode, setMode] = useState('login');

  // Form states for login (clean, no pre-filled demo data)
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);

  // Form states for signup
  const [signupFullName, setSignupFullName] = useState('');
  const [signupUsername, setSignupUsername] = useState('');
  const [signupPhone, setSignupPhone] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupConfirmPassword, setSignupConfirmPassword] = useState('');
  const [showSignupPassword, setShowSignupPassword] = useState(false);
  const [showSignupConfirmPassword, setShowSignupConfirmPassword] = useState(false);

  // Form states for forgot password recovery
  const [forgotIdentifier, setForgotIdentifier] = useState('');
  const [recoveredUser, setRecoveredUser] = useState(null);
  const [showRecoveredPassword, setShowRecoveredPassword] = useState(true);
  const [copiedPassword, setCopiedPassword] = useState(false);

  // Feedback states
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Handle Login Submit
  const handleLoginSubmit = (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    const identifier = loginIdentifier.trim();
    if (!identifier) {
      setErrorMsg('Please enter your username or phone number');
      return;
    }

    if (!loginPassword) {
      setErrorMsg('Please enter your password');
      return;
    }

    const users = getStoredUsers();
    const cleanPhoneInput = identifier.replace(/\D/g, '');

    // Match by username OR phone number
    const found = users.find((u) => {
      const matchPass = u.password === loginPassword;
      if (!matchPass) return false;

      const matchUser = u.username && u.username.toLowerCase() === identifier.toLowerCase();
      const matchPhone = cleanPhoneInput && u.phone && u.phone.replace(/\D/g, '') === cleanPhoneInput;

      return matchUser || matchPhone;
    });

    if (!found) {
      setErrorMsg('Invalid username/phone or password. Please check your credentials, or click "Forgot password?".');
      return;
    }

    setSuccessMsg(`Welcome back, ${found.fullName || found.username}!`);
    setCurrentUser(found);
    setTimeout(() => {
      onLoginSuccess(found);
    }, 450);
  };

  // Handle Forgot Password Submit (Retrieve original password)
  const handleForgotSubmit = (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    setRecoveredUser(null);
    setCopiedPassword(false);

    const identifier = forgotIdentifier.trim();
    if (!identifier) {
      setErrorMsg('Please enter your registered username or phone number');
      return;
    }

    const users = getStoredUsers();
    const cleanPhoneInput = identifier.replace(/\D/g, '');

    const found = users.find((u) => {
      const matchUser = u.username && u.username.toLowerCase() === identifier.toLowerCase();
      const matchPhone = cleanPhoneInput && u.phone && u.phone.replace(/\D/g, '') === cleanPhoneInput;
      return matchUser || matchPhone;
    });

    if (!found) {
      setErrorMsg(`No account found matching "${identifier}". Please check for typos or create a new account.`);
      return;
    }

    // Retrieve original password (from initial registration)
    const originalPass = found.originalPassword || found.password;
    setRecoveredUser({ ...found, originalPassword: originalPass });
    setSuccessMsg('Account verified! Here is your original registration password.');
  };

  // Handle Log In with Recovered Password
  const handleLoginWithRecovered = () => {
    if (!recoveredUser) return;
    const pwd = recoveredUser.originalPassword || recoveredUser.password;
    setLoginIdentifier(recoveredUser.username || recoveredUser.phone);
    setLoginPassword(pwd);
    setSuccessMsg(`Welcome back, ${recoveredUser.fullName || recoveredUser.username}!`);
    setCurrentUser(recoveredUser);
    setTimeout(() => {
      onLoginSuccess(recoveredUser);
    }, 450);
  };

  // Copy password to clipboard
  const handleCopyPassword = () => {
    const pwd = recoveredUser?.originalPassword || recoveredUser?.password;
    if (!pwd) return;
    try {
      navigator.clipboard.writeText(pwd);
      setCopiedPassword(true);
      setTimeout(() => setCopiedPassword(false), 2000);
    } catch {}
  };

  // Handle Signup Submit
  const handleSignupSubmit = (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!signupFullName.trim()) {
      setErrorMsg('Please enter your full name');
      return;
    }
    if (!signupUsername.trim()) {
      setErrorMsg('Please choose a username');
      return;
    }
    if (signupUsername.trim().length < 3) {
      setErrorMsg('Username must be at least 3 characters');
      return;
    }
    if (!signupPhone.trim()) {
      setErrorMsg('Please enter your phone number');
      return;
    }
    const cleanPhone = signupPhone.replace(/\D/g, '');
    if (cleanPhone.length < 10) {
      setErrorMsg('Please enter a valid 10-digit phone number');
      return;
    }
    if (!signupPassword) {
      setErrorMsg('Please create a password');
      return;
    }
    if (signupPassword.length < 4) {
      setErrorMsg('Password should be at least 4 characters');
      return;
    }
    if (signupPassword !== signupConfirmPassword) {
      setErrorMsg('Passwords do not match');
      return;
    }

    const users = getStoredUsers();

    // Check duplicate username
    const usernameExists = users.some(
      (u) => u.username && u.username.toLowerCase() === signupUsername.trim().toLowerCase()
    );
    if (usernameExists) {
      setErrorMsg('This username is already taken. Please choose another or log in.');
      return;
    }

    // Check duplicate phone
    const phoneExists = users.some((u) => u.phone && u.phone.replace(/\D/g, '') === cleanPhone);
    if (phoneExists) {
      setErrorMsg('This phone number is already registered. Please log in.');
      return;
    }

    const newUser = {
      fullName: signupFullName.trim(),
      username: signupUsername.trim(),
      phone: cleanPhone,
      password: signupPassword,
      originalPassword: signupPassword, // Preserves the very first password
      role: 'Administrator',
      createdAt: new Date().toISOString()
    };

    const updatedUsers = [...users, newUser];
    localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(updatedUsers));

    setSuccessMsg('Account created successfully! Logging you in...');
    setCurrentUser(newUser);

    setTimeout(() => {
      onLoginSuccess(newUser);
    }, 500);
  };

  return (
    <div className="auth-overlay">
      <div className="auth-card">
        {/* Header / Brand */}
        <div className="auth-header">
          <div className="auth-brand-badge">
            <Building2 className="brand-icon" size={26} />
            <span className="brand-dot"></span>
          </div>
          <h2 className="auth-title">BuildPay Portal</h2>
          <p className="auth-subtitle">
            Construction Finance & Payment Management System
          </p>

          {/* Mode Switch Tabs */}
          <div className="auth-mode-tabs" role="tablist">
            <button
              type="button"
              className={`mode-tab ${mode === 'login' ? 'active' : ''}`}
              onClick={() => {
                setMode('login');
                setErrorMsg('');
                setSuccessMsg('');
                setRecoveredUser(null);
              }}
            >
              <LogIn size={16} />
              <span>Sign In</span>
            </button>
            <button
              type="button"
              className={`mode-tab ${mode === 'signup' ? 'active' : ''}`}
              onClick={() => {
                setMode('signup');
                setErrorMsg('');
                setSuccessMsg('');
                setRecoveredUser(null);
              }}
            >
              <UserPlus size={16} />
              <span>Create Account</span>
            </button>
            {mode === 'forgot' && (
              <button
                type="button"
                className="mode-tab active"
                onClick={() => {
                  setMode('forgot');
                  setErrorMsg('');
                  setSuccessMsg('');
                }}
              >
                <KeyRound size={16} />
                <span>Forgot Password</span>
              </button>
            )}
          </div>
        </div>

        {/* Alert banners */}
        {errorMsg && (
          <div className="auth-alert error" role="alert">
            <AlertCircle size={18} />
            <span>{errorMsg}</span>
          </div>
        )}
        {successMsg && (
          <div className="auth-alert success" role="status">
            <CheckCircle2 size={18} />
            <span>{successMsg}</span>
          </div>
        )}

        {/* ─── LOGIN FORM ─── */}
        {mode === 'login' && (
          <form className="auth-form" onSubmit={handleLoginSubmit}>
            <div className="form-group">
              <label className="input-label" htmlFor="login-identifier">
                Username or Phone Number
              </label>
              <div className="input-wrapper">
                <User className="input-icon" size={18} />
                <input
                  id="login-identifier"
                  type="text"
                  className="auth-input"
                  placeholder="Enter your username or mobile number"
                  value={loginIdentifier}
                  onChange={(e) => setLoginIdentifier(e.target.value)}
                  autoComplete="username"
                  autoFocus
                />
              </div>
            </div>

            <div className="form-group">
              <div className="form-group-header">
                <label className="input-label" htmlFor="login-password">
                  Password
                </label>
                <button
                  type="button"
                  className="forgot-password-link"
                  onClick={() => {
                    setMode('forgot');
                    setForgotIdentifier(loginIdentifier || '');
                    setErrorMsg('');
                    setSuccessMsg('');
                    setRecoveredUser(null);
                  }}
                >
                  Forgot password?
                </button>
              </div>
              <div className="input-wrapper">
                <Lock className="input-icon" size={18} />
                <input
                  id="login-password"
                  type={showLoginPassword ? 'text' : 'password'}
                  className="auth-input has-eye"
                  placeholder="Enter your password"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  className="eye-toggle-btn"
                  title={showLoginPassword ? 'Hide password' : 'View password'}
                  aria-label={showLoginPassword ? 'Hide password' : 'View password'}
                  onClick={() => setShowLoginPassword(!showLoginPassword)}
                >
                  {showLoginPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <button type="submit" className="auth-primary-btn">
              <span>Sign In</span>
              <ArrowRight size={18} />
            </button>

            <div className="auth-footer-prompt">
              <span>Don't have an account yet?</span>
              <button
                type="button"
                className="auth-link-btn"
                onClick={() => {
                  setMode('signup');
                  setErrorMsg('');
                  setSuccessMsg('');
                  setRecoveredUser(null);
                }}
              >
                Sign up here
              </button>
            </div>
          </form>
        )}

        {/* ─── FORGOT PASSWORD FORM & RECOVERY ─── */}
        {mode === 'forgot' && (
          <form className="auth-form" onSubmit={handleForgotSubmit}>
            {!recoveredUser ? (
              <>
                <div className="forgot-instruction">
                  <KeyRound className="forgot-icon" size={20} />
                  <p>
                    Enter your registered <strong>Username</strong> or <strong>Phone Number</strong>. We will look up your account and retrieve the very first password you created at registration.
                  </p>
                </div>

                <div className="form-group">
                  <label className="input-label" htmlFor="forgot-identifier">
                    Username or Phone Number
                  </label>
                  <div className="input-wrapper">
                    <User className="input-icon" size={18} />
                    <input
                      id="forgot-identifier"
                      type="text"
                      className="auth-input"
                      placeholder="e.g. your username or 10-digit mobile number"
                      value={forgotIdentifier}
                      onChange={(e) => setForgotIdentifier(e.target.value)}
                      autoFocus
                    />
                  </div>
                </div>

                <button type="submit" className="auth-primary-btn">
                  <span>Get My Original Password</span>
                  <ArrowRight size={18} />
                </button>
              </>
            ) : (
              <div className="recovered-password-card">
                <div className="recovered-header">
                  <div className="recovered-check">
                    <Check size={18} />
                  </div>
                  <div>
                    <h4>Account Located!</h4>
                    <p>Here is your original account password from registration.</p>
                  </div>
                </div>

                <div className="recovered-details">
                  <div className="recovered-detail-row">
                    <span>Full Name:</span>
                    <strong>{recoveredUser.fullName || 'Registered User'}</strong>
                  </div>
                  <div className="recovered-detail-row">
                    <span>Username:</span>
                    <strong>{recoveredUser.username}</strong>
                  </div>
                  {recoveredUser.phone && (
                    <div className="recovered-detail-row">
                      <span>Phone:</span>
                      <strong>{recoveredUser.phone}</strong>
                    </div>
                  )}
                </div>

                <div className="recovered-pwd-box">
                  <span className="recovered-pwd-label">Original Registration Password</span>
                  <div className="recovered-pwd-val-row">
                    <span className="recovered-pwd-text">
                      {showRecoveredPassword
                        ? (recoveredUser.originalPassword || recoveredUser.password)
                        : '••••••••••••'}
                    </span>
                    <div className="recovered-pwd-actions">
                      <button
                        type="button"
                        className="pwd-action-btn"
                        title={showRecoveredPassword ? 'Hide password' : 'Show password'}
                        onClick={() => setShowRecoveredPassword(!showRecoveredPassword)}
                      >
                        {showRecoveredPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                        <span>{showRecoveredPassword ? 'Hide' : 'Show'}</span>
                      </button>
                      <button
                        type="button"
                        className="pwd-action-btn copy"
                        title="Copy password to clipboard"
                        onClick={handleCopyPassword}
                      >
                        {copiedPassword ? <Check size={14} /> : <Copy size={14} />}
                        <span>{copiedPassword ? 'Copied!' : 'Copy'}</span>
                      </button>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  className="auth-primary-btn"
                  onClick={handleLoginWithRecovered}
                >
                  <span>Log In With This Password</span>
                  <ArrowRight size={18} />
                </button>

                <button
                  type="button"
                  className="pwd-action-btn"
                  style={{ alignSelf: 'center', marginTop: 4, background: 'transparent', border: 'none', color: '#64748b' }}
                  onClick={() => {
                    setRecoveredUser(null);
                    setErrorMsg('');
                    setSuccessMsg('');
                  }}
                >
                  Look up a different account
                </button>
              </div>
            )}

            <div className="auth-footer-prompt">
              <span>Remembered your password?</span>
              <button
                type="button"
                className="auth-link-btn"
                onClick={() => {
                  setMode('login');
                  setErrorMsg('');
                  setSuccessMsg('');
                  setRecoveredUser(null);
                }}
              >
                Back to Sign in
              </button>
            </div>
          </form>
        )}

        {/* ─── SIGNUP FORM ─── */}
        {mode === 'signup' && (
          <form className="auth-form" onSubmit={handleSignupSubmit}>
            <div className="form-group">
              <label className="input-label" htmlFor="signup-name">
                Full Name
              </label>
              <div className="input-wrapper">
                <User className="input-icon" size={18} />
                <input
                  id="signup-name"
                  type="text"
                  className="auth-input"
                  placeholder="e.g. Ramesh Kumar"
                  value={signupFullName}
                  onChange={(e) => setSignupFullName(e.target.value)}
                  autoComplete="name"
                  autoFocus
                />
              </div>
            </div>

            <div className="form-row-2">
              <div className="form-group">
                <label className="input-label" htmlFor="signup-user">
                  Username
                </label>
                <div className="input-wrapper">
                  <User className="input-icon" size={18} />
                  <input
                    id="signup-user"
                    type="text"
                    className="auth-input"
                    placeholder="Choose a username"
                    value={signupUsername}
                    onChange={(e) => setSignupUsername(e.target.value)}
                    autoComplete="username"
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="input-label" htmlFor="signup-phone">
                  Phone Number
                </label>
                <div className="input-wrapper">
                  <Phone className="input-icon" size={18} />
                  <input
                    id="signup-phone"
                    type="tel"
                    className="auth-input"
                    placeholder="10-digit mobile number"
                    value={signupPhone}
                    onChange={(e) => setSignupPhone(e.target.value)}
                    autoComplete="tel"
                  />
                </div>
              </div>
            </div>

            <div className="form-group">
              <label className="input-label" htmlFor="signup-password">
                Password
              </label>
              <div className="input-wrapper">
                <Lock className="input-icon" size={18} />
                <input
                  id="signup-password"
                  type={showSignupPassword ? 'text' : 'password'}
                  className="auth-input has-eye"
                  placeholder="Create a strong password"
                  value={signupPassword}
                  onChange={(e) => setSignupPassword(e.target.value)}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  className="eye-toggle-btn"
                  title={showSignupPassword ? 'Hide password' : 'View password'}
                  aria-label={showSignupPassword ? 'Hide password' : 'View password'}
                  onClick={() => setShowSignupPassword(!showSignupPassword)}
                >
                  {showSignupPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div className="form-group">
              <label className="input-label" htmlFor="signup-confirm-password">
                Confirm Password
              </label>
              <div className="input-wrapper">
                <Lock className="input-icon" size={18} />
                <input
                  id="signup-confirm-password"
                  type={showSignupConfirmPassword ? 'text' : 'password'}
                  className="auth-input has-eye"
                  placeholder="Re-enter your password"
                  value={signupConfirmPassword}
                  onChange={(e) => setSignupConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  className="eye-toggle-btn"
                  title={showSignupConfirmPassword ? 'Hide password' : 'View password'}
                  aria-label={showSignupConfirmPassword ? 'Hide password' : 'View password'}
                  onClick={() => setShowSignupConfirmPassword(!showSignupConfirmPassword)}
                >
                  {showSignupConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <button type="submit" className="auth-primary-btn">
              <span>Create Account</span>
              <ArrowRight size={18} />
            </button>

            <div className="auth-footer-prompt">
              <span>Already have an account?</span>
              <button
                type="button"
                className="auth-link-btn"
                onClick={() => {
                  setMode('login');
                  setErrorMsg('');
                  setSuccessMsg('');
                }}
              >
                Sign in here
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
