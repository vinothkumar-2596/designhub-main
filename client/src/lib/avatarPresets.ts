export type AvatarVariant =
  | 'marble'
  | 'beam'
  | 'pixel'
  | 'sunset'
  | 'ring'
  | 'bauhaus'
  | 'geometric'
  | 'abstract';

export type AvatarPreset = {
  id: string;
  label: string;
  variant: AvatarVariant;
  colors: string[];
};

const AVATAR_PRESET_PREFIX = 'preset:';

export const avatarPresets: AvatarPreset[] = [
  {
    id: 'aurora',
    label: 'Aurora',
    variant: 'marble',
    colors: ['#4F46E5', '#1E3A8A', '#2563EB', '#0EA5E9', '#94A3FF'],
  },
  {
    id: 'graphite',
    label: 'Graphite',
    variant: 'beam',
    colors: ['#0F172A', '#1E293B', '#334155', '#475569', '#64748B'],
  },
  {
    id: 'nebula',
    label: 'Nebula',
    variant: 'ring',
    colors: ['#111827', '#1D4ED8', '#2563EB', '#22D3EE', '#E0E7FF'],
  },
  {
    id: 'mint',
    label: 'Mint',
    variant: 'sunset',
    colors: ['#0F172A', '#0EA5A6', '#14B8A6', '#34D399', '#A7F3D0'],
  },
  {
    id: 'studio',
    label: 'Studio',
    variant: 'bauhaus',
    colors: ['#0B1228', '#312E81', '#4F46E5', '#818CF8', '#E2E8F0'],
  },
];

export const toAvatarPresetValue = (presetId: string) => `${AVATAR_PRESET_PREFIX}${presetId}`;

export const getAvatarPreset = (avatar?: string | null) => {
  if (!avatar || !avatar.startsWith(AVATAR_PRESET_PREFIX)) {
    return null;
  }
  const presetId = avatar.slice(AVATAR_PRESET_PREFIX.length);
  return avatarPresets.find((preset) => preset.id === presetId) || null;
};

export const getDefaultAvatarValue = () => toAvatarPresetValue(avatarPresets[0].id);
