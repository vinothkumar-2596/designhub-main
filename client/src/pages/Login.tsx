import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { API_URL, authFetch } from '@/lib/api';
import { UserRole } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Palette, Users, Briefcase, Eye, EyeOff } from 'lucide-react';
import { useTheme } from 'next-themes';
import { toast } from 'sonner';

const roleOptions: { value: UserRole; label: string; icon: React.ElementType; description: string }[] = [
  { value: 'designer', label: 'Designer', icon: Palette, description: 'Manage & complete tasks' },
  { value: 'staff', label: 'Staff', icon: Users, description: 'Submit design requests' },
  { value: 'treasurer', label: 'Treasurer', icon: Briefcase, description: 'Approve modifications' },
];

export default function Login() {
  const { setTheme } = useTheme();
  const previousThemeRef = useRef<string | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('staff');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isResetOpen, setIsResetOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetPhone, setResetPhone] = useState('');
  const [otpSessionId, setOtpSessionId] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpVerified, setOtpVerified] = useState(false);
  const [isOtpSending, setIsOtpSending] = useState(false);
  const [isOtpVerifying, setIsOtpVerifying] = useState(false);
  const rotatingWords = ['simple', 'efficient', 'reliable'];
  const [wordIndex, setWordIndex] = useState(0);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setWordIndex((prev) => (prev + 1) % rotatingWords.length);
    }, 1800);
    return () => window.clearInterval(interval);
  }, []);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const storedTheme = window.localStorage.getItem('designhub-theme');
    const root = document.documentElement;
    const initialTheme =
      storedTheme ?? (root.classList.contains('dark') ? 'dark' : 'light');
    if (!previousThemeRef.current) {
      previousThemeRef.current = initialTheme;
    }
    if (initialTheme !== 'light') {
      setTheme('light');
    }
    return () => {
      const previousTheme = previousThemeRef.current;
      if (previousTheme && previousTheme !== 'light') {
        setTheme(previousTheme);
      }
    };
  }, [setTheme]);
  const [isResetLoading, setIsResetLoading] = useState(false);
  const [isSignupOpen, setIsSignupOpen] = useState(false);
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupRole, setSignupRole] = useState<UserRole>('staff');
  const [showSignupPassword, setShowSignupPassword] = useState(false);
  const { login, signup, loginWithGoogle, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const glassInputClass =
    'bg-white/75 border border-[#D9E6FF] backdrop-blur-lg font-semibold text-foreground/90 placeholder:text-[#9CA3AF] placeholder:opacity-100 focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:border-[#B7C8FF]';
  const glassButtonClass =
    'bg-white text-foreground hover:bg-[#F8FBFF]/95';
  const selectContentClass =
    'border border-[#C9D7FF] bg-white shadow-lg';
  const selectTriggerClass =
    'h-11 bg-white border border-[#D9E6FF] font-semibold text-foreground/90 focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:border-[#B7C8FF]';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      await login(email, password, role);
      toast.success('Welcome back!', {
        description: `Logged in as ${roleOptions.find(r => r.value === role)?.label}`,
      });
      navigate('/dashboard');
    } catch (error) {
      toast.error('Login failed', {
        description: 'Please check your credentials and try again.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      if (role !== 'staff') {
        toast.error('Google sign-in is for staff accounts only');
        return;
      }
      await loginWithGoogle(role);
    } catch (error) {
      toast.error('Google login failed');
    }
  };

  const handleOpenReset = () => {
    setResetEmail(email);
    setResetPhone('');
    setOtpSessionId('');
    setOtpCode('');
    setOtpVerified(false);
    setIsResetOpen(true);
  };

  const handleSendResetOtp = async () => {
    if (!resetPhone) {
      toast.error('Enter your phone number');
      return;
    }
    setIsOtpSending(true);
    setOtpVerified(false);
    try {
      if (!API_URL) {
        throw new Error('API URL is not configured');
      }
      const response = await fetch(`${API_URL}/api/auth/password/otp/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: resetPhone }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data?.success) {
        throw new Error(data?.error || 'Failed to send OTP');
      }
      setOtpSessionId(data.sessionId || '');
      toast.success('OTP sent', { description: 'Check your phone for the code.' });
    } catch (error) {
      toast.error('Failed to send OTP');
    } finally {
      setIsOtpSending(false);
    }
  };

  const handleVerifyResetOtp = async () => {
    if (!otpSessionId || !otpCode) {
      toast.error('Enter the OTP');
      return;
    }
    setIsOtpVerifying(true);
    try {
      if (!API_URL) {
        throw new Error('API URL is not configured');
      }
      const response = await fetch(`${API_URL}/api/auth/password/otp/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: otpSessionId, otp: otpCode }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data?.success) {
        throw new Error(data?.error || 'OTP verification failed');
      }
      setOtpVerified(true);
      toast.success('Phone verified');
    } catch (error) {
      toast.error('OTP verification failed');
    } finally {
      setIsOtpVerifying(false);
    }
  };

  const handleSendResetEmail = async () => {
    if (!resetEmail) {
      toast.error('Enter your email first');
      return;
    }
    if (!resetPhone) {
      toast.error('Enter your phone number first');
      return;
    }
    if (!otpSessionId || !otpCode) {
      toast.error('Enter the OTP');
      return;
    }
    if (!otpVerified) {
      toast.error('Verify OTP to continue');
      return;
    }

    setIsResetLoading(true);
    try {
      if (!API_URL) {
        throw new Error('API URL is not configured');
      }
      const response = await authFetch(`${API_URL}/api/auth/password/forgot`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: resetEmail,
          phone: resetPhone,
          sessionId: otpSessionId,
          otp: otpCode,
        }),
      });
      if (!response.ok) {
        throw new Error('Failed to send reset email');
      }
      toast.success('Reset email sent', {
        description: 'If the account exists, a reset link will arrive shortly.',
      });
      setIsResetOpen(false);
    } catch (error) {
      toast.error('Failed to send reset email');
    } finally {
      setIsResetLoading(false);
    }
  };

  const handleRoleChange = (nextRole: UserRole) => {
    setRole(nextRole);
  };

  const handleOpenSignup = () => {
    setSignupEmail(email);
    setSignupPassword(password);
    setSignupRole(role);
    setIsSignupOpen(true);
  };

  const handleSignupSubmit = async () => {
    if (!signupEmail || !signupPassword) {
      toast.error('Email and password are required');
      return;
    }
    setIsLoading(true);
    try {
      await signup(signupEmail, signupPassword, signupRole);
      toast.success('Account created');
      navigate('/dashboard');
    } catch (error) {
      toast.error('Signup failed');
    } finally {
      setIsLoading(false);
      setIsSignupOpen(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard');
    }
  }, [isAuthenticated, navigate]);

  return (
    <>
      <div className="min-h-screen flex bg-background">
        {/* Left Panel - Branding */}
        <div className="hidden lg:flex lg:w-1/2 bg-sidebar relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(99,102,241,0.22),_transparent_55%),radial-gradient(circle_at_bottom,_rgba(59,130,246,0.18),_transparent_60%)]" />
          <div className="absolute inset-0 [mask-image:radial-gradient(ellipse_at_center,transparent_20%,black)]">
            <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(148,163,184,0.18)_1px,transparent_1px),linear-gradient(to_bottom,rgba(148,163,184,0.18)_1px,transparent_1px)] bg-[size:20px_20px] opacity-35" />
          </div>
          <div className="relative z-10 flex flex-col justify-center px-16 ml-[150px] text-sidebar-foreground">
            <div className="animate-slide-in-left">
              <div className="flex items-center gap-3 mb-8">
                <div
                  className="h-12 w-12 rounded-xl flex items-center justify-center p-1"
                  style={{ backgroundColor: 'rgb(21, 30, 60)' }}
                >
                  <img src="/favicon.png" alt="DesignDesk" className="h-full w-full object-contain" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-sidebar-primary-foreground">DesignDesk</h1>
                  <p className="text-sm text-sidebar-foreground/70">Task Management Portal</p>
                </div>
              </div>

              <h2 className="text-4xl font-bold mb-4 leading-tight">
                <span className="block text-transparent bg-clip-text bg-gradient-to-r from-slate-100 via-slate-300 to-slate-100">
                  Design workflows.
                </span>
                <span className="block">
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-slate-100 via-slate-300 to-slate-100">
                    made{' '}
                  </span>
                  <span
                    key={wordIndex}
                    className="login-dynamic-word gradient-name inline-block min-w-[9ch] text-left text-transparent bg-clip-text bg-gradient-to-r from-sky-300 via-indigo-400 to-pink-300 animate-word-swap"
                  >
                    {rotatingWords[wordIndex]}.
                  </span>
                </span>
              </h2>
              <p className="text-lg text-sidebar-foreground/80 mb-8 max-w-md">
                A single platform to request,<br />track, and collaborate.
              </p>

            </div>
          </div>

          {/* Decorative Elements */}
          <div className="absolute bottom-0 right-0 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
          <div className="absolute top-20 right-20 w-64 h-64 bg-accent/10 rounded-full blur-3xl" />
        </div>

        {/* Right Panel - Login Form */}
        <div className="relative flex-1 flex items-center justify-center p-8 overflow-hidden bg-transparent md:bg-[#F6F8FF]/60">
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute -top-24 left-10 h-64 w-64 rounded-full bg-[#E6ECFF]/60 blur-3xl" />
            <div className="absolute bottom-10 right-16 h-72 w-72 rounded-full bg-[#DCE9FF]/60 blur-3xl" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.08),_transparent_55%)]" />
          </div>
          <div className="relative w-full max-w-md animate-fade-in">
            {/* Mobile Logo */}
            <div className="lg:hidden flex items-center gap-3 mb-8 justify-center">
              <div
                className="h-10 w-10 rounded-xl flex items-center justify-center p-1"
                style={{ backgroundColor: 'rgb(21, 30, 60)' }}
              >
                <img src="/favicon.png" alt="DesignDesk" className="h-full w-full object-contain" />
              </div>
              <div>
                <h1 className="text-xl font-bold">DesignDesk</h1>
                <p className="text-xs text-muted-foreground">Task Portal</p>
              </div>
            </div>

            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-foreground">Welcome back</h2>
              <p className="text-muted-foreground mt-2">Sign in to access your dashboard</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="Enter your email address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={`h-11 ${glassInputClass} placeholder:text-[#9CA3AF] placeholder:opacity-100`}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    key={showPassword ? 'password-text' : 'password-hidden'}
                    placeholder="********"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={`h-11 pr-10 ${glassInputClass}`}
                  />
                  <button
                    type="button"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    aria-pressed={showPassword}
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {role !== 'designer' ? (
                  <button
                    type="button"
                    className="text-xs text-primary hover:underline"
                    onClick={handleOpenReset}
                  >
                    Forgot password? Send reset link
                  </button>
                ) : null}
              </div>

              <div className="space-y-2">
                <Label>Role</Label>
                <Select value={role} onValueChange={(v) => handleRoleChange(v as UserRole)}>
                  <SelectTrigger className={selectTriggerClass}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className={selectContentClass}>
                    {roleOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        <div className="flex items-center gap-2">
                          <option.icon className="h-4 w-4 text-muted-foreground" />
                          <span className="font-semibold text-foreground/90">{option.label}</span>
                          <span className="text-[11px] text-foreground/70">
                            - {option.description}
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Select a role to experience different portal views
                </p>
              </div>

              <Button
                type="submit"
                className="w-full h-11 bg-[#35429A] text-white border border-white/30 backdrop-blur-lg shadow-sm transition-colors hover:bg-[#2F3C8A]"
                disabled={isLoading}
              >
                {isLoading ? 'Signing in...' : 'Sign in'}
              </Button>
              {role === 'staff' ? (
                <Button
                  type="button"
                  variant="outline"
                  className={`w-full h-11 ${glassButtonClass} border-0 bg-transparent backdrop-blur-xl ring-1 ring-white/20 shadow-[0_10px_26px_-18px_rgba(59,130,246,0.45)] hover:bg-transparent`}
                  disabled={isLoading}
                  onClick={handleOpenSignup}
                >
                  Create account
                </Button>
              ) : null}
            </form>

            <div className="my-6 flex items-center gap-3">
              <div className="h-px flex-1 bg-border" />
              <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground">or</span>
              <div className="h-px flex-1 bg-border" />
            </div>

            <Button
              type="button"
              variant="outline"
              className={`w-full h-11 ${glassButtonClass} border-0`}
              onClick={handleGoogleLogin}
              disabled={isLoading}
            >
              <span className="inline-flex items-center justify-center gap-2">
                <svg
                  aria-hidden="true"
                  viewBox="0 0 533.5 544.3"
                  className="h-4 w-4"
                >
                  <path
                    d="M533.5 278.4c0-18.8-1.5-37-4.3-54.6H272v103.4h146.9c-6.3 34-25.2 62.8-53.8 82l86.9 67.6c50.7-46.8 81.5-115.9 81.5-198.4z"
                    fill="#4285F4"
                  />
                  <path
                    d="M272 544.3c72.7 0 133.7-24.1 178.3-65.4l-86.9-67.6c-24.1 16.2-55 25.8-91.4 25.8-70 0-129.4-47.2-150.7-110.5H32.9v69.5c44.4 88.1 135.4 148.2 239.1 148.2z"
                    fill="#34A853"
                  />
                  <path
                    d="M121.3 326.6c-10.4-31-10.4-64.6 0-95.6V161.5H32.9c-38.6 77.2-38.6 168.2 0 245.4l88.4-69.5z"
                    fill="#FBBC05"
                  />
                  <path
                    d="M272 107.7c39.6-.6 77.6 14 106.7 40.9l79.4-79.4C407.3 24.1 346.3 0 272 0 168.3 0 77.3 60.1 32.9 148.2l88.4 69.5C142.6 154.9 202 107.7 272 107.7z"
                    fill="#EA4335"
                  />
                </svg>
                <span>Continue with Google</span>
              </span>
            </Button>
            {role === 'staff' ? (
              <p className="text-center text-xs text-muted-foreground mt-3">
                Staff can sign up with Google or use Create account.
              </p>
            ) : null}

          </div>
        </div>
      </div>
      <Dialog open={isResetOpen} onOpenChange={setIsResetOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset password</DialogTitle>
            <DialogDescription>
              Verify your phone with OTP, then we'll send a reset link to your email.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="reset-email">Email</Label>
              <Input
                id="reset-email"
                type="email"
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
                placeholder="you@gmail.com"
                className={glassInputClass}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="reset-phone">Phone number (OTP)</Label>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <Input
                  id="reset-phone"
                  type="tel"
                  value={resetPhone}
                  onChange={(e) => {
                    setResetPhone(e.target.value);
                    setOtpVerified(false);
                  }}
                  placeholder="9003776002"
                  className={glassInputClass}
                />
                <Button
                  type="button"
                  variant="outline"
                  className={glassButtonClass}
                  onClick={handleSendResetOtp}
                  disabled={isOtpSending}
                >
                  {isOtpSending ? 'Sending...' : 'Send OTP'}
                </Button>
              </div>
            </div>
            {otpSessionId ? (
              <div className="space-y-2">
                <Label htmlFor="reset-otp">OTP</Label>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <Input
                    id="reset-otp"
                    type="text"
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value)}
                    placeholder="Enter OTP"
                    className={glassInputClass}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    className={glassButtonClass}
                    onClick={handleVerifyResetOtp}
                    disabled={isOtpVerifying}
                  >
                    {isOtpVerifying ? 'Verifying...' : otpVerified ? 'Verified' : 'Verify OTP'}
                  </Button>
                </div>
              </div>
            ) : null}
            <Button
              type="button"
              variant="outline"
              className={glassButtonClass}
              onClick={handleSendResetEmail}
              disabled={isResetLoading || !otpVerified}
            >
              {isResetLoading ? 'Sending...' : 'Send reset link'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={isSignupOpen} onOpenChange={setIsSignupOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create staff account</DialogTitle>
            <DialogDescription>
              Sign up with your Gmail and set a password.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="signup-email">Email</Label>
              <Input
                id="signup-email"
                type="email"
                value={signupEmail}
                onChange={(e) => setSignupEmail(e.target.value)}
                placeholder="you@gmail.com"
                className={glassInputClass}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="signup-password">Password</Label>
              <div className="relative">
                <Input
                  id="signup-password"
                  type={showSignupPassword ? 'text' : 'password'}
                  key={showSignupPassword ? 'signup-password-text' : 'signup-password-hidden'}
                  value={signupPassword}
                  onChange={(e) => setSignupPassword(e.target.value)}
                  placeholder="Create a password"
                  className={`pr-10 ${glassInputClass}`}
                />
                <button
                  type="button"
                  aria-label={showSignupPassword ? 'Hide password' : 'Show password'}
                  aria-pressed={showSignupPassword}
                  onClick={() => setShowSignupPassword((prev) => !prev)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showSignupPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={signupRole} onValueChange={(value) => setSignupRole(value as UserRole)}>
                <SelectTrigger className={selectTriggerClass}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className={selectContentClass}>
                  <SelectItem value="staff">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      <span className="font-semibold text-foreground/90">Staff</span>
                      <span className="text-[11px] text-foreground/70">- Submit design requests</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="designer">
                    <div className="flex items-center gap-2">
                      <Palette className="h-4 w-4 text-muted-foreground" />
                      <span className="font-semibold text-foreground/90">Designer</span>
                      <span className="text-[11px] text-foreground/70">- Manage & complete tasks</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="treasurer">
                    <div className="flex items-center gap-2">
                      <Briefcase className="h-4 w-4 text-muted-foreground" />
                      <span className="font-semibold text-foreground/90">Treasurer</span>
                      <span className="text-[11px] text-foreground/70">- Approve modifications</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className={glassButtonClass}
              onClick={handleSignupSubmit}
              disabled={isLoading}
            >
              {isLoading ? 'Creating...' : 'Create account'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}


