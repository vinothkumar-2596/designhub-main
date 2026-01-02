import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { sendPasswordResetEmail } from 'firebase/auth';
import { useAuth } from '@/contexts/AuthContext';
import { auth, firebaseEnabled } from '@/lib/firebase';
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
import { Palette, Shield, Users, Briefcase } from 'lucide-react';
import { toast } from 'sonner';

const roleOptions: { value: UserRole; label: string; icon: React.ElementType; description: string }[] = [
  { value: 'admin', label: 'Administrator', icon: Shield, description: 'Full system access' },
  { value: 'designer', label: 'Designer', icon: Palette, description: 'Manage & complete tasks' },
  { value: 'staff', label: 'Staff', icon: Users, description: 'Submit design requests' },
  { value: 'treasurer', label: 'Treasurer', icon: Briefcase, description: 'Approve modifications' },
];

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('staff');
  const [isLoading, setIsLoading] = useState(false);
  const [isResetOpen, setIsResetOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [isResetLoading, setIsResetLoading] = useState(false);
  const [isSignupOpen, setIsSignupOpen] = useState(false);
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupRole, setSignupRole] = useState<UserRole>('staff');
  const { login, signup, loginWithGoogle } = useAuth();
  const navigate = useNavigate();

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
      toast.success('Signed in with Google');
      navigate('/dashboard');
    } catch (error) {
      toast.error('Google login failed');
    }
  };

  const handleOpenReset = () => {
    setResetEmail(email);
    setIsResetOpen(true);
  };

  const handleSendResetEmail = async () => {
    if (!resetEmail) {
      toast.error('Enter your email first');
      return;
    }

    setIsResetLoading(true);
    try {
      if (!firebaseEnabled || !auth) {
        throw new Error('Firebase email is not configured');
      }
      await sendPasswordResetEmail(auth, resetEmail);
      toast.success('Reset email sent', {
        description: `Check ${resetEmail} for a password reset link.`,
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

  return (
    <>
      <div className="min-h-screen flex bg-background">
        {/* Left Panel - Branding */}
        <div className="hidden lg:flex lg:w-1/2 bg-sidebar relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-transparent" />
          <div className="relative z-10 flex flex-col justify-center px-16 text-sidebar-foreground">
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

              <h2 className="text-4xl font-bold text-sidebar-primary-foreground mb-4 leading-tight">
                Streamline Your<br />Design Workflow
              </h2>
              <p className="text-lg text-sidebar-foreground/80 mb-8 max-w-md">
                Submit requests, track progress, and collaborate seamlessly with your design team.
              </p>

              <div className="space-y-4">
                {[
                  'Submit design requests with all required materials',
                  'Track real-time status of every request',
                  'Automated notifications and reminders',
                  'Transparent approval workflow',
                ].map((feature, index) => (
                  <div key={index} className="flex items-center gap-3">
                    <div className="h-2 w-2 rounded-full bg-primary" />
                    <span className="text-sidebar-foreground/90">{feature}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Decorative Elements */}
          <div className="absolute bottom-0 right-0 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
          <div className="absolute top-20 right-20 w-64 h-64 bg-accent/10 rounded-full blur-3xl" />
        </div>

        {/* Right Panel - Login Form */}
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="w-full max-w-md animate-fade-in">
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
                  placeholder="you@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-11"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="********"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-11"
                />
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
                <Label>Role (Demo)</Label>
                <Select value={role} onValueChange={(v) => handleRoleChange(v as UserRole)}>
                  <SelectTrigger className="h-11">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {roleOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        <div className="flex items-center gap-2">
                          <option.icon className="h-4 w-4 text-muted-foreground" />
                          <span>{option.label}</span>
                          <span className="text-xs text-muted-foreground">
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

              <Button type="submit" className="w-full h-11" disabled={isLoading}>
                {isLoading ? 'Signing in...' : 'Sign in'}
              </Button>
              {role === 'staff' ? (
                <Button
                  type="button"
                  variant="secondary"
                  className="w-full h-11"
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
              className="w-full h-11"
              onClick={handleGoogleLogin}
              disabled={isLoading}
            >
              Continue with Google
            </Button>
            {role === 'staff' ? (
              <p className="text-center text-xs text-muted-foreground mt-3">
                Staff can sign up with Google or create an account.
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
              We'll send a password reset link to your email.
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
              />
            </div>
            <Button type="button" variant="outline" onClick={handleSendResetEmail} disabled={isResetLoading}>
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
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="signup-password">Password</Label>
              <Input
                id="signup-password"
                type="password"
                value={signupPassword}
                onChange={(e) => setSignupPassword(e.target.value)}
                placeholder="Create a password"
              />
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={signupRole} onValueChange={(value) => setSignupRole(value as UserRole)}>
                <SelectTrigger className="h-11">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="staff">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      <span>Staff</span>
                      <span className="text-xs text-muted-foreground">- Submit design requests</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="designer">
                    <div className="flex items-center gap-2">
                      <Palette className="h-4 w-4 text-muted-foreground" />
                      <span>Designer</span>
                      <span className="text-xs text-muted-foreground">- Manage & complete tasks</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="treasurer">
                    <div className="flex items-center gap-2">
                      <Briefcase className="h-4 w-4 text-muted-foreground" />
                      <span>Treasurer</span>
                      <span className="text-xs text-muted-foreground">- Approve modifications</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="admin">
                    <div className="flex items-center gap-2">
                      <Shield className="h-4 w-4 text-muted-foreground" />
                      <span>Administrator</span>
                      <span className="text-xs text-muted-foreground">- Full system access</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" onClick={handleSignupSubmit} disabled={isLoading}>
              {isLoading ? 'Creating...' : 'Create account'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
