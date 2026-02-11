import { useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Home } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { LottieLoader } from '@/components/LottieLoader';

const NotFound = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    console.error('404 Error: User attempted to access non-existent route:', location.pathname);
  }, [location.pathname]);

  const primaryRoute = isAuthenticated ? '/dashboard' : '/login';
  const primaryLabel = isAuthenticated ? 'Go to Dashboard' : 'Go to Login';

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-[#F7FAFF] via-[#EEF4FF] to-[#E5EEFF] dark:from-slate-950 dark:via-slate-900 dark:to-slate-900">
      <div className="pointer-events-none absolute -left-20 top-10 h-72 w-72 rounded-full bg-[#DCE8FF]/85 blur-3xl dark:bg-[#253A7A]/35" />
      <div className="pointer-events-none absolute -right-16 bottom-8 h-72 w-72 rounded-full bg-[#E7F0FF]/80 blur-3xl dark:bg-[#2C4A97]/25" />

      <div className="relative mx-auto flex min-h-screen max-w-3xl items-center justify-center px-6 py-12">
        <div className="w-full rounded-[30px] border border-[#C9D7FF]/70 bg-gradient-to-br from-white/88 via-[#F5F8FF]/82 to-[#EAF2FF]/78 supports-[backdrop-filter]:bg-[#F5F8FF]/65 backdrop-blur-2xl p-8 text-center shadow-none dark:border-border dark:bg-card/90 dark:backdrop-blur-none">
          <div className="relative mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-[#C9D7FF]/70 bg-gradient-to-br from-white/95 to-[#E7EFFF]/90 text-[#2B3E78] dark:border-[#3B5E9F]/70 dark:from-[#1C3A74]/95 dark:to-[#132950]/92 dark:text-[#E4EBFF]">
            <span className="pointer-events-none absolute inset-0 rounded-2xl bg-[#DCE8FF]/65 dark:bg-gradient-to-br dark:from-[#244A8D]/35 dark:to-[#152C58]/20" />
            <LottieLoader src="/lottie/warning-brand.json?v=20260211" className="relative z-10 h-9 w-9" />
          </div>

          <p className="mt-6 text-[11px] font-semibold uppercase tracking-[0.28em] text-[#6B7A99] dark:text-muted-foreground">
            Error 404
          </p>
          <h1 className="mt-2 text-3xl font-bold text-[#1E2A5A] dark:text-foreground premium-headline">
            Page Not Found
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-sm text-[#5B6F93] dark:text-muted-foreground premium-body">
            The route <span className="font-semibold text-[#324C86] dark:text-foreground">{location.pathname}</span>{' '}
            does not exist. Use the actions below to continue safely.
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate(-1)}
              className="h-10 rounded-full border-[#C9D7FF] bg-white/82 px-5 text-[#1E2A5A] hover:bg-[#EEF4FF] dark:border-border dark:bg-card dark:text-foreground dark:hover:bg-muted"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Go Back
            </Button>

            <Button
              asChild
              className="h-10 rounded-full border border-white/35 bg-primary/80 bg-gradient-to-r from-white/15 via-primary/80 to-primary/90 px-5 text-white shadow-none hover:bg-primary/85 dark:border-transparent"
            >
              <Link to={primaryRoute}>
                <Home className="mr-2 h-4 w-4" />
                {primaryLabel}
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
