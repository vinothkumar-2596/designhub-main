import { ReactNode } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  BookOpen,
  ClipboardList,
  AlarmClock,
  Bell,
  Settings,
  Users,
  LifeBuoy,
  ChevronDown,
  Mail,
} from 'lucide-react';

type HelpItem = {
  title: string;
  icon: React.ElementType;
  body: ReactNode;
};

const helpItems: HelpItem[] = [
  {
    title: 'Getting Started',
    icon: BookOpen,
    body: (
      <>
        <p>
          DesignDesk is a centralized portal for submitting and managing design
          requests for your organization.
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Log in using your staff credentials.</li>
          <li>After logging in, you will see your Dashboard Overview.</li>
          <li>
            If you do not have an account, contact your department head or portal
            administrator.
          </li>
        </ul>
      </>
    ),
  },
  {
    title: 'Dashboard Overview',
    icon: ClipboardList,
    body: (
      <>
        <p>Your dashboard provides a snapshot of your design activity.</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Welcome message shows your user name and quick links.</li>
          <li>Total tasks overview shows requested, pending, in progress, completed.</li>
          <li>Important notices cover submission standards and guidance.</li>
          <li>Recent activity lists your most recent design requests.</li>
        </ul>
      </>
    ),
  },
  {
    title: 'Submitting a New Request',
    icon: ClipboardList,
    body: (
      <>
        <ol className="list-decimal space-y-1 pl-5">
          <li>Click the New Request button in the Dashboard or left navigation.</li>
          <li>
            Fill in details: Title, Description, Category, Attachments, Deadline.
          </li>
          <li>Review your information and click Submit.</li>
        </ol>
        <div className="mt-3 rounded-xl border border-[#E3EBFF] bg-[#F6F9FF] p-3 dark:border-border dark:bg-slate-900/60">
          <p className="text-sm font-semibold text-[#1E2A5A] dark:text-slate-100">
            Best practices for submission
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5 dark:text-slate-300">
            <li>Provide complete details and upload all references.</li>
            <li>Give designers at least 3 working days.</li>
            <li>Avoid vague instructions; follow the notices for standards.</li>
          </ul>
        </div>
      </>
    ),
  },
  {
    title: 'Tracking Your Requests',
    icon: ClipboardList,
    body: (
      <>
        <p>
          Use the My Requests section to view all design requests you have
          submitted.
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Status badge and submission date.</li>
          <li>Files attached and designer replies.</li>
          <li>Comments thread for collaboration.</li>
          <li>View details link for full information.</li>
        </ul>
      </>
    ),
  },
  {
    title: 'Request Status Definitions',
    icon: AlarmClock,
    body: (
      <div className="space-y-2">
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 dark:border-[#1E3A75]/70 dark:bg-[#11234A]/70">
          <p className="font-semibold text-amber-700 dark:text-slate-100">Pending</p>
          <p className="text-xs text-amber-700/80 dark:text-slate-300">
            Task submitted and awaiting action. No designer assigned yet.
          </p>
        </div>
        <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 dark:border-[#1E3A75]/70 dark:bg-[#11234A]/70">
          <p className="font-semibold text-blue-700 dark:text-slate-100">In Progress</p>
          <p className="text-xs text-blue-700/80 dark:text-slate-300">
            A designer has started working on your request.
          </p>
        </div>
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 dark:border-[#1E3A75]/70 dark:bg-[#11234A]/70">
          <p className="font-semibold text-emerald-700 dark:text-slate-100">Completed</p>
          <p className="text-xs text-emerald-700/80 dark:text-slate-300">
            Design work is finished and final files are uploaded.
          </p>
        </div>
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 dark:border-[#1E3A75]/70 dark:bg-[#11234A]/70">
          <p className="font-semibold text-rose-700 dark:text-slate-100">Overdue</p>
          <p className="text-xs text-rose-700/80 dark:text-slate-300">
            The expected deadline has passed without completion.
          </p>
        </div>
        <p className="text-xs text-[#7B8CAD] dark:text-slate-400">
          If a request seems stuck for too long, contact support or your department
          supervisor.
        </p>
      </div>
    ),
  },
  {
    title: 'Designer Availability',
    icon: Users,
    body: (
      <p>
        Check Designer Availability in the left navigation to see which designers
        can take new requests. This helps you plan timing based on workload.
      </p>
    ),
  },
  {
    title: 'Notifications & Alerts',
    icon: Bell,
    body: (
      <>
        <ul className="list-disc space-y-1 pl-5">
          <li>New comments on your requests.</li>
          <li>Status change alerts (Approved / In Progress / Completed).</li>
          <li>Deadline reminders and overdue alerts.</li>
        </ul>
        <p className="text-xs text-[#7B8CAD] dark:text-slate-400">
          Update notification preferences in Settings.
        </p>
      </>
    ),
  },
  {
    title: 'Account Settings',
    icon: Settings,
    body: (
      <ul className="list-disc space-y-1 pl-5">
        <li>Update your profile details.</li>
        <li>Change your email or password.</li>
        <li>Manage notification preferences.</li>
        <li>Use Logout to securely end your session.</li>
      </ul>
    ),
  },
  {
    title: 'Support & Contact',
    icon: LifeBuoy,
    body: (
      <>
        <p>Contact DesignDesk Support for help or urgent issues.</p>
        <div className="mt-3 space-y-2 text-sm">
          <div className="rounded-lg border border-[#D9E6FF] bg-white/80 px-3 py-2 dark:border-border dark:bg-slate-900/60">
            <p className="font-semibold text-[#1E2A5A] dark:text-slate-100">Email Support</p>
            <p>support@DesignDesk.yourdomain.com</p>
            <p className="text-xs text-[#7B8CAD] dark:text-slate-400">
              Response time: up to 24 hours on business days.
            </p>
          </div>
          <div className="rounded-lg border border-[#D9E6FF] bg-white/80 px-3 py-2 dark:border-border dark:bg-slate-900/60">
            <p className="font-semibold text-[#1E2A5A] dark:text-slate-100">Report Issues</p>
            <p>Use the Support Form in Settings.</p>
            <p className="text-xs text-[#7B8CAD] dark:text-slate-400">
              Include screenshots and steps to reproduce.
            </p>
          </div>
        </div>
      </>
    ),
  },
  {
    title: 'Frequently Asked Questions',
    icon: BookOpen,
    body: (
      <div className="space-y-3">
        <div>
          <p className="font-semibold text-[#1E2A5A] dark:text-slate-100">
            How many files can I upload per request?
          </p>
          <p>You can attach multiple files such as PDFs, images, and references.</p>
        </div>
        <div>
          <p className="font-semibold text-[#1E2A5A] dark:text-slate-100">What is the minimum lead time?</p>
          <p>
            Standard lead times are 3 working days. Videos or complex requests may
            take longer.
          </p>
        </div>
        <div>
          <p className="font-semibold text-[#1E2A5A] dark:text-slate-100">
            Can I edit a request after submission?
          </p>
          <p>
            You can add comments or files, but core details should be correct
            before submitting. If changes are required, contact the designer.
          </p>
        </div>
        <div>
          <p className="font-semibold text-[#1E2A5A] dark:text-slate-100">Why is my task overdue?</p>
          <p>
            Overdue means the deadline has passed without completion. You can view
            reasons or updates in the request details.
          </p>
        </div>
      </div>
    ),
  },
];

export default function Help() {
  return (
    <DashboardLayout>
      <div className="rounded-[32px] border border-[#D9E6FF] bg-white/90 p-6 md:p-10 shadow-[0_24px_60px_-40px_rgba(15,23,42,0.35)] dark:border-border dark:bg-card/90 dark:shadow-[0_24px_60px_-40px_rgba(0,0,0,0.6)]">
        <div className="grid gap-8 lg:grid-cols-[1.05fr_1fr]">
          <div className="space-y-6">
            <div className="space-y-3">
              <Badge className="rounded-full border border-[#DDE6FF] bg-white/80 text-[#5B6B8A] dark:border-border dark:bg-muted/70 dark:text-slate-300">
                Help & Support - DesignDesk Task Portal
              </Badge>
              <h1 className="text-3xl md:text-4xl font-semibold text-[#1E2A5A] dark:text-slate-100 premium-headline">
                Frequently asked questions
              </h1>
              <p className="text-base text-[#5B6B8A] dark:text-slate-400 premium-body">
                Welcome to the Help Center. Find answers about submitting requests,
                tracking progress, and managing your tasks in the DesignDesk portal.
              </p>
            </div>

            <div className="rounded-2xl border border-[#E3EBFF] bg-[#F5F7FF] p-5 shadow-[0_18px_40px_-30px_rgba(15,23,42,0.3)] dark:border-border dark:bg-slate-900/60 dark:shadow-none">
              <h2 className="text-lg font-semibold text-[#1E2A5A] dark:text-slate-100 premium-heading">
                Still have questions?
              </h2>
              <p className="mt-2 text-sm text-[#5B6B8A] dark:text-slate-400 premium-body">
                Cannot find the answer? Send us an email and we will get back to you
                as soon as possible.
              </p>
              <Button asChild className="mt-4 rounded-full px-6">
                <a href="mailto:support@DesignDesk.yourdomain.com">
                  Send email
                </a>
              </Button>
            </div>

            <div className="rounded-2xl border border-[#E3EBFF] bg-[#F9FBFF] p-4 dark:border-border dark:bg-slate-900/50">
              <div className="flex items-center gap-2 text-sm font-semibold text-[#1E2A5A] dark:text-slate-100">
                <Mail className="h-4 w-4" />
                Support Email
              </div>
              <p className="mt-2 text-sm text-[#5B6B8A] dark:text-slate-400">
                support@DesignDesk.yourdomain.com
              </p>
              <p className="text-xs text-[#7B8CAD] dark:text-slate-500">
                Response time: up to 24 hours on business days.
              </p>
            </div>
          </div>

          <div className="space-y-4">
            {helpItems.map((item, index) => {
              const Icon = item.icon;
              return (
                <details
                  key={item.title}
                  open={index === 0}
                  className="group rounded-2xl border border-[#E3EBFF] bg-[#F7F9FF] p-4 shadow-sm dark:border-border dark:bg-slate-900/50"
                >
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-semibold text-[#1E2A5A] dark:text-slate-100">
                    <span className="flex items-center gap-2">
                      <Icon className="h-4 w-4 text-[#4F6EF7] dark:text-primary" />
                      {item.title}
                    </span>
                    <span className="flex h-8 w-8 items-center justify-center rounded-full border border-[#D6E2FF] bg-white text-[#4F6EF7] transition group-open:rotate-180 dark:border-border dark:bg-slate-900/70 dark:text-primary">
                      <ChevronDown className="h-4 w-4" />
                    </span>
                  </summary>
                  <div className="mt-3 space-y-2 text-sm text-[#5B6B8A] dark:text-slate-300">
                    {item.body}
                  </div>
                </details>
              );
            })}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}


