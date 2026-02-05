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
    variant: 'beam',
    colors: ['#111827', '#2563EB', '#60A5FA', '#A78BFA', '#F8FAFC'],
  },
  {
    id: 'graphite',
    label: 'Graphite',
    variant: 'bauhaus',
    colors: ['#0B1020', '#1F2937', '#334155', '#94A3B8', '#E2E8F0'],
  },
  {
    id: 'nebula',
    label: 'Nebula',
    variant: 'pixel',
    colors: ['#0F172A', '#22D3EE', '#38BDF8', '#6366F1', '#F8FAFC'],
  },
  {
    id: 'mint',
    label: 'Mint',
    variant: 'abstract',
    colors: ['#0B1020', '#1E293B', '#334155', '#60A5FA', '#E2E8F0'],
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
