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

  if (preset) {
    return (
      <div className={cn('overflow-hidden rounded-full', className)}>
        <BoringAvatar
          size="100%"
          name={`${name}-${preset.id}`}
          variant={preset.variant}
          colors={preset.colors}
          title
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
