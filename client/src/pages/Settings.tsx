import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
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
import { User, Bell, Palette, Users, Briefcase } from 'lucide-react';
import { toast } from 'sonner';
import { useEffect, useState } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

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
  const [defaultCategory, setDefaultCategory] = useState('');
  const [defaultUrgency, setDefaultUrgency] = useState('normal');
  const [deadlineBufferDays, setDeadlineBufferDays] = useState('3');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingProfile, setPendingProfile] = useState<{
    name: string;
    email: string;
    phone?: string;
  } | null>(null);
  const sanitizeName = (value: string) => value.replace(/\d+/g, '');

  useEffect(() => {
    setFullName(user?.name || '');
    setEmail(user?.email || '');
    setPhone(user?.phone || '');
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

  const applyProfileUpdate = (payload: { name: string; email: string; phone?: string }) => {
    updateUser(payload);
    toast.success('Profile updated locally');
  };

  const handleSaveProfile = () => {
    const sanitizedName = sanitizeName(fullName).trim();
    const nextProfile = {
      name: sanitizedName || user?.name || '',
      email: email.trim() || user?.email || '',
      phone: phone.trim() || undefined,
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
          <h1 className="text-2xl font-bold text-foreground">Settings</h1>
          <p className="text-muted-foreground mt-1">
            Manage your account and preferences
          </p>
        </div>

        {/* Profile Section */}
        <div id="profile" className="bg-card border border-border/70 rounded-2xl p-5 shadow-card animate-slide-up">
          <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
            <User className="h-5 w-5" />
            Profile
          </h2>
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 rounded-full bg-primary flex items-center justify-center text-2xl font-bold text-primary-foreground">
                {user?.name.charAt(0)}
              </div>
              <div>
                <p className="font-semibold text-foreground">{user?.name}</p>
                <p className="text-sm text-muted-foreground">{user?.email}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {user?.department} Department
                </p>
              </div>
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
                  placeholder="+18005551234"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Used for WhatsApp updates about requests and final files.
                </p>
              </div>
            </div>
            <Button onClick={handleSaveProfile}>Save Changes</Button>
          </div>
        </div>

        {/* Request Defaults */}
        <div className="bg-card border border-border/70 rounded-2xl p-5 shadow-card animate-slide-up">
          <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
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

        {/* Role Switcher (Demo) */}
        <div className="bg-card border border-border/70 rounded-2xl p-5 shadow-card animate-slide-up">
          <h2 className="text-lg font-semibold text-foreground mb-2 flex items-center gap-2">
            <Users className="h-5 w-5" />
            Demo: Switch Role
          </h2>
          <p className="text-sm text-muted-foreground mb-4">
            Switch between different roles to explore the portal features
          </p>
          <div className="grid grid-cols-2 gap-3">
            {roleOptions.map((role) => (
              <Button
                key={role.value}
                variant={user?.role === role.value ? 'default' : 'outline'}
                onClick={() => handleRoleSwitch(role.value)}
                className="justify-start gap-2 border border-transparent hover:border-[#C9D7FF] hover:bg-[#E6F1FF]/70 hover:text-primary hover:backdrop-blur-md hover:shadow-[0_10px_22px_-16px_rgba(15,23,42,0.35)]"
              >
                <role.icon className="h-4 w-4" />
                {role.label}
              </Button>
            ))}
          </div>
        </div>

        {/* Notifications */}
        <div className="bg-card border border-border/70 rounded-2xl p-5 shadow-card animate-slide-up">
          <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Notifications
          </h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-foreground">Email Notifications</p>
                <p className="text-sm text-muted-foreground">
                  Receive updates about your tasks via email
                </p>
              </div>
              <Switch defaultChecked />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-foreground">WhatsApp Notifications</p>
                <div className="flex items-center gap-2">
                  <p className="text-sm text-muted-foreground">
                    Get instant updates on WhatsApp
                  </p>
                  <a href="/whatsapp-templates" className="text-[10px] text-primary hover:underline bg-primary/5 px-2 py-0.5 rounded-full font-semibold">
                    VIEW TEMPLATES
                  </a>
                </div>
              </div>
              <Switch />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-foreground">Deadline Reminders</p>
                <p className="text-sm text-muted-foreground">
                  Get notified before task deadlines
                </p>
              </div>
              <Switch defaultChecked />
            </div>
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
