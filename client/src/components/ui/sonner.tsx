import { useTheme } from "next-themes";
import { Toaster as Sonner, toast } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:rounded-2xl group-[.toaster]:border group-[.toaster]:border-[#D9E6FF] group-[.toaster]:bg-white/80 group-[.toaster]:text-foreground group-[.toaster]:backdrop-blur-xl group-[.toaster]:shadow-[0_18px_45px_-30px_rgba(37,99,235,0.45)] group-[.toaster]:supports-[backdrop-filter]:bg-white/60",
          title: "font-sans",
          description: "group-[.toast]:text-muted-foreground font-sans",
          icon: "text-primary",
          actionButton:
            "group-[.toast]:rounded-full group-[.toast]:bg-[#EEF4FF] group-[.toast]:text-foreground group-[.toast]:shadow-sm hover:group-[.toast]:bg-[#E6F0FF]",
          cancelButton:
            "group-[.toast]:rounded-full group-[.toast]:bg-white/80 group-[.toast]:text-muted-foreground hover:group-[.toast]:bg-white",
        },
      }}
      {...props}
    />
  );
};

export { Toaster, toast };
