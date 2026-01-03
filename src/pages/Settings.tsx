import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { UserRole } from '@/types';
import { User, Bell, Palette, Users, Briefcase } from 'lucide-react';
import { toast } from 'sonner';

const roleOptions: { value: UserRole; label: string; icon: React.ElementType }[] = [
  { value: 'designer', label: 'Designer', icon: Palette },
  { value: 'staff', label: 'Staff', icon: Users },
  { value: 'treasurer', label: 'Treasurer', icon: Briefcase },
];

export default function Settings() {
  const { user, switchRole } = useAuth();

  const handleRoleSwitch = (role: UserRole) => {
    switchRole(role);
    toast.success(`Switched to ${roleOptions.find(r => r.value === role)?.label} view`);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-4xl">
        {/* Header */}
        <div className="animate-fade-in">
          <h1 className="text-2xl font-bold text-foreground">Settings</h1>
          <p className="text-muted-foreground mt-1">
            Manage your account and preferences
          </p>
        </div>

        {/* Profile Section */}
        <div className="bg-card border border-border/70 rounded-2xl p-5 shadow-card animate-slide-up">
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
                <Input id="name" defaultValue={user?.name} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" defaultValue={user?.email} />
              </div>
            </div>
            <Button>Save Changes</Button>
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
                <p className="text-sm text-muted-foreground">
                  Get instant updates on WhatsApp
                </p>
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
    </DashboardLayout>
  );
}
