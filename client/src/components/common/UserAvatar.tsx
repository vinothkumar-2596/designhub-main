import { useEffect, useState } from 'react';
import BoringAvatar from 'boring-avatars';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { getAvatarPreset } from '@/lib/avatarPresets';
import { cn } from '@/lib/utils';

type UserAvatarProps = {
  name: string;
  avatar?: string;
  className?: string;
  fallbackClassName?: string;
};

const getInitials = (name: string) => {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
};

export function UserAvatar({ name, avatar, className, fallbackClassName }: UserAvatarProps) {
  const preset = getAvatarPreset(avatar);
  const [isSmiling, setIsSmiling] = useState(false);

  useEffect(() => {
    const triggerSmile = () => {
      setIsSmiling(true);
      const resetTimer = window.setTimeout(() => {
        setIsSmiling(false);
      }, 1600);
      return resetTimer;
    };

    let resetTimer: number | null = null;
    const smileInterval = window.setInterval(() => {
      resetTimer = triggerSmile();
    }, 60000);

    return () => {
      window.clearInterval(smileInterval);
      if (resetTimer !== null) {
        window.clearTimeout(resetTimer);
      }
    };
  }, []);

  if (preset) {
    return (
      <div className={cn('relative overflow-hidden rounded-full', className)}>
        <div
          className={cn(
            'h-full w-full transition-transform duration-300 ease-out',
            isSmiling ? '-translate-y-[1px]' : ''
          )}
        >
          <BoringAvatar
            size="100%"
            name={`${name}-${preset.id}`}
            variant={preset.variant}
            colors={preset.colors}
            title
          />
        </div>
        <span
          aria-hidden="true"
          className={cn(
            'pointer-events-none absolute bottom-[23%] left-1/2 h-[3px] w-[10px] -translate-x-1/2 rounded-full border-b border-[#1E2A5A]/65 transition-all duration-300 ease-out',
            isSmiling ? 'opacity-100 translate-y-[1px]' : 'opacity-0'
          )}
        />
      </div>
    );
  }

  return (
    <Avatar className={className}>
      {avatar ? <AvatarImage src={avatar} alt={name} /> : null}
      <AvatarFallback
        className={cn('bg-primary text-primary-foreground font-semibold', fallbackClassName)}
      >
        {getInitials(name)}
      </AvatarFallback>
    </Avatar>
  );
}
