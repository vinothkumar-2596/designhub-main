import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { UserRole } from '@/types';
import { User, Palette, Users, Briefcase, Check } from 'lucide-react';
import { toast } from 'sonner';
import { useEffect, useState } from 'react';
import BoringAvatar from 'boring-avatars';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { UserAvatar } from '@/components/common/UserAvatar';
import { avatarPresets, getDefaultAvatarValue, toAvatarPresetValue } from '@/lib/avatarPresets';
import { cn } from '@/lib/utils';

const roleOptions: { value: UserRole; label: string; icon: React.ElementType }[] = [
  { value: 'designer', label: 'Designer', icon: Palette },
  { value: 'staff', label: 'Staff', icon: Users },
  { value: 'treasurer', label: 'Treasurer', icon: Briefcase },
];

export default function Settings() {
  const { user, switchRole, updateUser } = useAuth();
  const [fullName, setFullName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [profileAvatar, setProfileAvatar] = useState(user?.avatar || getDefaultAvatarValue());
  const [defaultCategory, setDefaultCategory] = useState('');
  const [defaultUrgency, setDefaultUrgency] = useState('normal');
  const [deadlineBufferDays, setDeadlineBufferDays] = useState('3');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingProfile, setPendingProfile] = useState<{
    name: string;
    email: string;
    phone?: string;
    avatar?: string;
  } | null>(null);
  const defaultDepartment =
    user?.department?.trim() ||
    roleOptions.find((option) => option.value === user?.role)?.label ||
    'General';
  const sanitizeName = (value: string) => value.replace(/\d+/g, '');
  const normalizeIndianPhone = (value: string) => {
    const raw = value.trim();
    if (!raw) return '';
    const digits = raw.replace(/[^\d]/g, '');
    if (!digits) return '';
    const withCountry = digits.startsWith('91') ? digits.slice(2) : digits;
    const normalized =
      digits.length === 10
        ? digits
        : withCountry.length === 10
          ? withCountry
          : '';
    return normalized ? `+91${normalized}` : '';
  };

  useEffect(() => {
    setFullName(user?.name || '');
    setEmail(user?.email || '');
    setPhone(user?.phone || '');
    setProfileAvatar(user?.avatar || getDefaultAvatarValue());
  }, [user]);

  useEffect(() => {
    const saved = localStorage.getItem('designhub:requestDefaults');
    if (!saved) return;
    try {
      const parsed = JSON.parse(saved);
      if (parsed.category) setDefaultCategory(parsed.category);
      if (parsed.urgency) setDefaultUrgency(parsed.urgency);
      if (typeof parsed.deadlineBufferDays === 'number') {
        setDeadlineBufferDays(String(parsed.deadlineBufferDays));
      }
    } catch {
      // Ignore invalid storage
    }
  }, []);

  const handleRoleSwitch = (role: UserRole) => {
    switchRole(role);
    toast.success(`Switched to ${roleOptions.find(r => r.value === role)?.label} view`);
  };

  const applyProfileUpdate = (payload: {
    name: string;
    email: string;
    phone?: string;
    avatar?: string;
  }) => {
    updateUser(payload);
    toast.success('Profile updated locally');
  };

  const handleSaveProfile = () => {
    const sanitizedName = sanitizeName(fullName).trim();
    const normalizedPhone = normalizeIndianPhone(phone);
    if (phone.trim() && !normalizedPhone) {
      toast.error('Enter a valid Indian WhatsApp number (e.g., +919876543210).');
      return;
    }
    const nextProfile = {
      name: sanitizedName || user?.name || '',
      email: email.trim() || user?.email || '',
      phone: normalizedPhone || undefined,
      avatar: profileAvatar || undefined,
    };
    const currentEmail = (user?.email || '').trim();
    const nextEmail = (nextProfile.email || '').trim();
    const emailChanged = currentEmail !== nextEmail;
    if (emailChanged) {
      setPendingProfile(nextProfile);
      setConfirmOpen(true);
      return;
    }
    applyProfileUpdate(nextProfile);
  };

  const handleSaveDefaults = () => {
    const parsedDays = Number(deadlineBufferDays);
    const sanitizedDays = Number.isFinite(parsedDays) && parsedDays >= 0 ? parsedDays : 3;
    localStorage.setItem(
      'designhub:requestDefaults',
      JSON.stringify({
        category: defaultCategory || undefined,
        urgency: defaultUrgency || 'normal',
        deadlineBufferDays: sanitizedDays,
      })
    );
    setDeadlineBufferDays(String(sanitizedDays));
    toast.success('Request defaults saved');
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-4xl mx-auto w-full">
        {/* Header */}
        <div className="animate-fade-in">
          <h1 className="text-2xl font-bold text-foreground premium-headline">Settings</h1>
          <p className="text-muted-foreground mt-1 premium-body">
            Manage your account and preferences
          </p>
        </div>

        {/* Profile Section */}
        <div id="profile" className="bg-card border border-border/70 rounded-2xl p-5 shadow-card animate-slide-up">
          <h2 className="text-lg font-semibold text-foreground premium-heading mb-4 flex items-center gap-2">
            <User className="h-5 w-5" />
            Profile
          </h2>
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <UserAvatar
                name={user?.name || 'User'}
                avatar={profileAvatar}
                className="h-16 w-16 border border-white/10"
                fallbackClassName="text-2xl font-bold"
              />
              <div>
                <p className="font-semibold text-foreground">{user?.name}</p>
                <p className="text-sm text-muted-foreground">{user?.email}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {defaultDepartment} Department
                </p>
              </div>
            </div>
            <Separator />
            <div className="space-y-2">
              <Label htmlFor="avatar-options">Profile Avatar</Label>
              <div id="avatar-options" className="flex flex-wrap gap-3">
                {avatarPresets.map((preset) => {
                  const presetValue = toAvatarPresetValue(preset.id);
                  const isActive = profileAvatar === presetValue;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => setProfileAvatar(presetValue)}
                      className={cn(
                        'relative h-12 w-12 overflow-hidden rounded-full border transition-all duration-200',
                        isActive
                          ? 'border-primary ring-2 ring-primary/30 shadow-[0_0_0_1px_hsl(var(--primary)/0.45)]'
                          : 'border-border/80 hover:border-primary/45'
                      )}
                      aria-label={`Use ${preset.label} avatar`}
                    >
                      <BoringAvatar
                        size="100%"
                        name={`${fullName || user?.name || user?.email || 'user'}-${preset.id}`}
                        variant={preset.variant}
                        colors={preset.colors}
                      />
                      {isActive && (
                        <span className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-primary-foreground">
                          <Check className="h-3 w-3" />
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-muted-foreground">
                Choose from 5 profile avatars.
              </p>
            </div>
            <Separator />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Full Name</Label>
                <Input
                  id="name"
                  value={fullName}
                  onChange={(event) => setFullName(sanitizeName(event.target.value))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone (WhatsApp)</Label>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="+919876543210"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Use an Indian number with country code (e.g., +919876543210).
                </p>
              </div>
            </div>
            <Button onClick={handleSaveProfile}>Save Changes</Button>
          </div>
        </div>

        {/* Request Defaults (Designer only) */}
        {user?.role === 'designer' && (
          <div className="bg-card border border-border/70 rounded-2xl p-5 shadow-card animate-slide-up">
            <h2 className="text-lg font-semibold text-foreground premium-heading mb-4 flex items-center gap-2">
              <Briefcase className="h-5 w-5" />
              Request Defaults
            </h2>
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Default Category</Label>
                  <Select value={defaultCategory} onValueChange={setDefaultCategory}>
                    <SelectTrigger>
                      <SelectValue placeholder="No default" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="banner">Banner</SelectItem>
                      <SelectItem value="campaign_or_others">Campaign or others</SelectItem>
                      <SelectItem value="social_media_creative">Social Media Creative</SelectItem>
                      <SelectItem value="website_assets">Website Assets</SelectItem>
                      <SelectItem value="ui_ux">UI/UX</SelectItem>
                      <SelectItem value="led_backdrop">LED Backdrop</SelectItem>
                      <SelectItem value="brochure">Brochure</SelectItem>
                      <SelectItem value="flyer">Flyer</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Default Urgency</Label>
                  <Select value={defaultUrgency} onValueChange={setDefaultUrgency}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="normal">Normal</SelectItem>
                      <SelectItem value="intermediate">Intermediate</SelectItem>
                      <SelectItem value="urgent">Urgent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Default Deadline Buffer (days)</Label>
                <Input
                  type="number"
                  min="0"
                  value={deadlineBufferDays}
                  onChange={(event) => setDeadlineBufferDays(event.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Used to auto-set the deadline when creating a new request.
                </p>
              </div>
              <Button onClick={handleSaveDefaults}>Save Defaults</Button>
            </div>
          </div>
        )}

        {/* Role Switcher (Demo) */}
        <div className="bg-card border border-border/70 rounded-2xl p-5 shadow-card animate-slide-up">
          <h2 className="text-lg font-semibold text-foreground premium-heading mb-2 flex items-center gap-2">
            <Users className="h-5 w-5" />
            Demo: Switch Role
          </h2>
          <p className="text-sm text-muted-foreground mb-4">
            Switch between different roles to explore the portal features
          </p>
          <div className="grid grid-cols-2 gap-3">
            {roleOptions.map((role) => {
              const isActive = user?.role === role.value;
              return (
                <Button
                  key={role.value}
                  variant="ghost"
                  onClick={() => handleRoleSwitch(role.value)}
                  className={cn(
                    'justify-start gap-2 rounded-xl border h-11',
                    isActive
                      ? 'border-primary/45 bg-primary text-primary-foreground hover:bg-primary/95 hover:text-primary-foreground dark:border-primary/40 dark:bg-primary/85 dark:text-white dark:hover:bg-primary/80'
                      : 'border-[#D9E6FF] bg-white text-[#1E2A5A] hover:border-[#C9D7FF] hover:bg-[#EEF4FF] hover:text-[#1E2A5A] dark:border-slate-700/70 dark:bg-slate-900/70 dark:text-slate-200 dark:hover:border-slate-600/80 dark:hover:bg-slate-800/75 dark:hover:text-slate-100'
                  )}
                >
                  <role.icon className="h-4 w-4" />
                  {role.label}
                </Button>
              );
            })}
          </div>
        </div>

      </div>
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm email change</AlertDialogTitle>
            <AlertDialogDescription>
              You are changing the account email. Please confirm to proceed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="rounded-xl border border-[#D9E6FF] bg-[#F6F8FF]/70 px-4 py-3 text-sm text-[#2F3A56]">
            <div className="flex justify-between gap-4">
              <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Current</span>
              <span className="font-medium">{user?.email || '—'}</span>
            </div>
            <div className="mt-2 flex justify-between gap-4">
              <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground">New</span>
              <span className="font-medium">{pendingProfile?.email || '—'}</span>
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                setPendingProfile(null);
              }}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!pendingProfile) return;
                applyProfileUpdate(pendingProfile);
                setPendingProfile(null);
              }}
            >
              Confirm change
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
