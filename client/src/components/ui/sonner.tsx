import { useTheme } from "next-themes";
import { Toaster as Sonner, toast } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "light", resolvedTheme } = useTheme();
  const activeTheme = (resolvedTheme || theme) as ToasterProps["theme"];
  const isDark = activeTheme === "dark";
  const toastBaseClass = isDark
    ? "group toast rounded-2xl border border-[#1E3A75]/70 bg-[#0F1F45]/92 text-slate-100 backdrop-blur-xl shadow-[0_20px_44px_-30px_rgba(2,6,23,0.9)]"
    : "group toast rounded-2xl border border-[#D9E6FF] bg-white/80 text-foreground backdrop-blur-xl shadow-[0_18px_45px_-30px_rgba(37,99,235,0.45)] supports-[backdrop-filter]:bg-white/60";
  const toastTitleClass = isDark ? "font-sans text-slate-100" : "font-sans";
  const toastDescriptionClass = isDark
    ? "font-sans text-slate-300"
    : "font-sans text-muted-foreground";
  const toastActionClass = isDark
    ? "rounded-full bg-slate-800 text-slate-100 hover:bg-slate-700"
    : "rounded-full bg-[#EEF4FF] text-foreground shadow-sm hover:bg-[#E6F0FF]";
  const toastCancelClass = isDark
    ? "rounded-full bg-slate-900/80 text-slate-300 hover:bg-slate-800"
    : "rounded-full bg-white/80 text-muted-foreground hover:bg-white";

  return (
    <Sonner
      theme={activeTheme}
      className="toaster group"
      toastOptions={{
        classNames: {
          toast: toastBaseClass,
          title: toastTitleClass,
          description: toastDescriptionClass,
          icon: isDark ? "text-indigo-300" : "text-primary",
          actionButton: toastActionClass,
          cancelButton: toastCancelClass,
          error: isDark ? "border-rose-400/45" : "border-rose-300/70",
          success: isDark ? "border-[#1E3A75]/70" : "border-[#D9E6FF]",
          warning: isDark ? "border-amber-400/40" : "border-amber-300/70",
          info: isDark ? "border-sky-400/40" : "border-sky-300/70",
        },
      }}
      {...props}
    />
  );
};

export { Toaster, toast };
