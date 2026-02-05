import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import Lottie from 'lottie-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Upload,
  FileText,
  Clock,
  Info,
  X,
  Image,
  Flag,
  Megaphone,
  Share2,
  Globe,
  Layout,
  Monitor,
  BookOpen,
  Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';
import { Task, TaskCategory, TaskChange, TaskUrgency } from '@/types';
import {
  addDays,
  format,
  isBefore,
  isWithinInterval,
  startOfDay,
} from 'date-fns';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import Box from '@mui/material/Box';
import LinearProgress, { LinearProgressProps } from '@mui/material/LinearProgress';
import Typography from '@mui/material/Typography';
import { useAuth } from '@/contexts/AuthContext';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  buildInvalidRanges,
  buildScheduleFromTasks,
  getDefaultDesignerId,
  Task as ScheduleTask,
} from '@/lib/designerSchedule';
import { upsertLocalTask } from '@/lib/taskStorage';
import { TaskBuddyModal } from '@/components/ai/TaskBuddyModal';
import { GeminiBlink } from '@/components/common/GeminiBlink';
import type { TaskDraft } from '@/lib/ai';

interface UploadedFile {
  id: string;
  name: string;
  size: number;
  driveId?: string;
  url?: string;
  thumbnailUrl?: string;
  extractedContent?: string;
  uploading?: boolean;
  progress?: number;
  error?: string;
}


const colorKeywords = [
  'dark blue',
  'navy',
  'blue',
  'red',
  'green',
  'orange',
  'yellow',
  'purple',
  'black',
  'white',
  'gold',
  'silver',
];

const modificationKeywords = ['edit', 'change', 'revise', 'modify', 'update', 'rework'];

const toCleanText = (value: string) => value.replace(/\s+/g, ' ').trim();

const extractSize = (text: string) => {
  const sizeMatch = text.match(
    /(\d+(?:\.\d+)?)\s*(ft|feet|in|cm|mm|px)\s*(?:x|×)\s*(\d+(?:\.\d+)?)\s*(ft|feet|in|cm|mm|px)?/i
  );
  if (sizeMatch) {
    const width = Number(sizeMatch[1]);
    const height = Number(sizeMatch[3]);
    const unit = (sizeMatch[4] || sizeMatch[2]).toLowerCase();
    return {
      value: `${sizeMatch[1]} ${unit} x ${sizeMatch[3]} ${unit}`,
      width,
      height,
      unit,
    };
  }

  const altMatch = text.match(
    /(\d+(?:\.\d+)?)\s*(?:x|×)\s*(\d+(?:\.\d+)?)\s*(ft|feet|in|cm|mm|px)/i
  );
  if (altMatch) {
    const width = Number(altMatch[1]);
    const height = Number(altMatch[2]);
    const unit = altMatch[3].toLowerCase();
    return {
      value: `${altMatch[1]} ${unit} x ${altMatch[2]} ${unit}`,
      width,
      height,
      unit,
    };
  }

  return null;
};

const extractDateFromText = (text: string) => {
  const numericMatch = text.match(/(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/);
  if (numericMatch) {
    const day = Number(numericMatch[1]);
    const month = Number(numericMatch[2]);
    let year = Number(numericMatch[3]);
    if (year < 100) year += 2000;
    return new Date(year, month - 1, day);
  }

  const monthMatch = text.match(
    /\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|sept|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\b\.?,?\s*(\d{1,2})(?:,?\s*(\d{4}))?/i
  );
  if (monthMatch) {
    const monthName = monthMatch[1].toLowerCase();
    const day = Number(monthMatch[2]);
    const year = monthMatch[3] ? Number(monthMatch[3]) : new Date().getFullYear();
    const monthMap: Record<string, number> = {
      jan: 0,
      january: 0,
      feb: 1,
      february: 1,
      mar: 2,
      march: 2,
      apr: 3,
      april: 3,
      may: 4,
      jun: 5,
      june: 5,
      jul: 6,
      july: 6,
      aug: 7,
      august: 7,
      sep: 8,
      sept: 8,
      september: 8,
      oct: 9,
      october: 9,
      nov: 10,
      november: 10,
      dec: 11,
      december: 11,
    };
    const monthIndex = monthMap[monthName];
    if (typeof monthIndex === 'number') {
      return new Date(year, monthIndex, day);
    }
  }

  return null;
};

const extractTimeRange = (text: string) => {
  const timeMatch = text.match(
    /(\d{1,2}(?::\d{2})?\s*(?:am|pm))\s*(?:-|–|to)\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm))/i
  );
  if (timeMatch) {
    return `${timeMatch[1].toUpperCase()} – ${timeMatch[2].toUpperCase()}`;
  }

  return null;
};

const extractLanguage = (text: string) => {
  const lower = text.toLowerCase();
  if (lower.includes('both')) return 'Tamil / English (Both)';
  if (lower.includes('tamil') || text.includes('தமிழ்') || text.includes('தமிழர்')) return 'Tamil';
  if (lower.includes('english')) return 'English';
  return null;
};

const extractEventName = (text: string) => {
  const eventMatch = text.match(/event\s*(?:name)?\s*[:\-]\s*([^\n,]+)/i);
  if (eventMatch) return toCleanText(eventMatch[1]);

  const forMatch = text.match(
    /for\s+([^\n,]+?)\s+(banner|poster|flyer|brochure|reel|certificate|design|invite|invitation)/i
  );
  if (forMatch) return toCleanText(forMatch[1]);

  const quotedMatch = text.match(/["'“”‘’]([^"'“”‘’]+)["'“”‘’]/);
  if (quotedMatch) return toCleanText(quotedMatch[1]);

  return null;
};

const extractVenue = (text: string) => {
  const venueMatch = text.match(/venue\s*[:\-]\s*([^\n,]+)/i);
  if (venueMatch) return toCleanText(venueMatch[1]);
  return null;
};

const extractTagline = (text: string) => {
  const taglineMatch = text.match(/tagline\s*[:\-]\s*([^\n]+)/i);
  if (taglineMatch) return toCleanText(taglineMatch[1]);
  return null;
};

const extractThemeColor = (text: string) => {
  const lower = text.toLowerCase();
  return colorKeywords.find((color) => lower.includes(color)) || null;
};

const extractCategory = (text: string): TaskCategory => {
  const lower = text.toLowerCase();
  const matches = [
    { value: 'banner', keywords: ['banner', 'standee', 'flex'] },
    { value: 'social_media_creative', keywords: ['social', 'instagram', 'facebook', 'post', 'story', 'reel', 'video'] },
    { value: 'flyer', keywords: ['flyer', 'handbill', 'leaflet'] },
    { value: 'brochure', keywords: ['brochure', 'catalog'] },
    { value: 'website_assets', keywords: ['website', 'web', 'landing page', 'landing', 'hero'] },
    { value: 'ui_ux', keywords: ['ui', 'ux', 'app', 'dashboard', 'prototype'] },
    { value: 'led_backdrop', keywords: ['led', 'backdrop', 'stage'] },
    { value: 'campaign_or_others', keywords: ['campaign', 'certificate', 'poster', 'logo', 'branding', 'invite', 'invitation'] },
  ] as const;

  for (const match of matches) {
    if (match.keywords.some((keyword) => lower.includes(keyword))) {
      return match.value;
    }
  }

  return 'campaign_or_others';
};

const getCategoryLabel = (category: TaskCategory) =>
  categoryOptions.find((option) => option.value === category)?.label || 'Design';

const getAssetLabel = (category: TaskCategory) => {
  switch (category) {
    case 'social_media_creative':
      return 'social media creative';
    case 'website_assets':
      return 'website asset';
    case 'ui_ux':
      return 'UI/UX layout';
    case 'led_backdrop':
      return 'LED backdrop';
    case 'campaign_or_others':
      return 'campaign asset';
    default:
      return category;
  }
};

const getDeliverablesForCategory = (category: TaskCategory) => {
  switch (category) {
    case 'social_media_creative':
      return ['Social media post (1080x1080)', 'Story/Reel version (1080x1920)'];
    case 'website_assets':
      return ['Primary web banner/hero asset', 'Mobile-friendly variant'];
    case 'ui_ux':
      return ['High-fidelity UI screens', 'Prototype-ready assets (if required)'];
    case 'brochure':
      return ['Print-ready brochure PDF', 'Editable source file (if applicable)'];
    case 'flyer':
      return ['Print-ready flyer PDF', 'Web-friendly version'];
    case 'led_backdrop':
      return ['Stage-ready LED backdrop design', 'Scaled preview version'];
    case 'banner':
      return ['Event banner (print-ready)', 'Optional digital version for social media'];
    default:
      return ['Primary design output', 'Optional digital version'];
  }
};

const buildAttachmentChecklist = (text: string) => {
  const lower = text.toLowerCase();
  const checklist = new Set<string>();
  if (lower.includes('smvec')) checklist.add('SMVEC logo');
  if (text.includes('ழ') || lower.includes('zha')) checklist.add("‘ழ’ logo");
  checklist.add('Primary logo (mandatory)');

  if (lower.includes('brand guideline') || lower.includes('brand guide') || lower.includes('brandbook')) {
    checklist.add('Brand guidelines (if available)');
  }

  if (lower.includes('reference') || lower.includes('sample') || lower.includes('example')) {
    checklist.add('Reference design (optional)');
  } else {
    checklist.add('Reference design (optional)');
  }

  return Array.from(checklist);
};

const parseIsoDate = (value: string) => {
  const match = value.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
};

const categoryOptions: { value: TaskCategory; label: string; icon: React.ElementType }[] = [
  { value: 'banner', label: 'Banner', icon: Flag },
  { value: 'campaign_or_others', label: 'Campaign or others', icon: Megaphone },
  { value: 'social_media_creative', label: 'Social Media Creative', icon: Share2 },
  { value: 'website_assets', label: 'Website Assets', icon: Globe },
  { value: 'ui_ux', label: 'UI/UX', icon: Layout },
  { value: 'led_backdrop', label: 'LED Backdrop', icon: Monitor },
  { value: 'brochure', label: 'Brochure', icon: BookOpen },
  { value: 'flyer', label: 'Flyer', icon: FileText },
];

const getFileIcon = (fileName: string, className: string) => {
  const extension = fileName.split('.').pop()?.toLowerCase();
  if (extension === 'pdf') return <FileText className={className} />;
  if (extension && ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'].includes(extension)) {
    return <Image className={className} />;
  }
  return <FileText className={className} />;
};

function LinearProgressWithLabel(props: LinearProgressProps & { value: number }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center' }}>
      <Box sx={{ width: '100%', mr: 1 }}>
        <LinearProgress variant="determinate" {...props} />
      </Box>
      <Box sx={{ minWidth: 35 }}>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          {`${Math.round(props.value)}%`}
        </Typography>
      </Box>
    </Box>
  );
}

import { API_URL, authFetch, getAuthToken } from '@/lib/api';

export default function NewRequest() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showGuidelines, setShowGuidelines] = useState(true);
  const [showThankYou, setShowThankYou] = useState(false);
  const [thankYouAnimation, setThankYouAnimation] = useState<object | null>(null);
  const [uploadAnimation, setUploadAnimation] = useState<object | null>(null);
  const [isTaskBuddyOpen, setIsTaskBuddyOpen] = useState(false);

  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<TaskCategory | ''>('');
  const [urgency, setUrgency] = useState<TaskUrgency>('normal');
  const [deadline, setDeadline] = useState<Date | null>(null);
  const [hasDeadlineInteracted, setHasDeadlineInteracted] = useState(false);
  const [isEmergency, setIsEmergency] = useState(false);
  const [requesterPhone, setRequesterPhone] = useState(user?.phone || '');
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [scheduleTasks, setScheduleTasks] = useState<ScheduleTask[]>([]);
  const [defaultsApplied, setDefaultsApplied] = useState(false);

  const applyAiDraft = (draft: TaskDraft) => {
    setTitle(draft.title);
    setDescription(draft.description);
    setCategory(draft.category);
    setUrgency(draft.urgency ?? 'normal');
    if (draft.deadline) {
      const parsedDate = new Date(draft.deadline);
      if (!isNaN(parsedDate.getTime())) {
        setDeadline(parsedDate);
      }
    }
    if (draft.whatsappNumbers && draft.whatsappNumbers.length > 0) {
      setRequesterPhone(draft.whatsappNumbers.join(', '));
    }
  };
  // Initialize from AI Buddy state if provided
  useEffect(() => {
    if (location.state?.aiDraft) {
      const draft = location.state.aiDraft as TaskDraft;
      if (draft) {
        applyAiDraft(draft);
        toast.success("AI Buddy: Draft applied to form!");
        return;
      }
    }
  }, [location.state]);
  const glassPanelClass =
    'bg-gradient-to-br from-white/85 via-white/70 to-[#E6F1FF]/75 supports-[backdrop-filter]:from-white/65 supports-[backdrop-filter]:via-white/55 supports-[backdrop-filter]:to-[#E6F1FF]/60 backdrop-blur-2xl border border-[#C9D7FF] ring-1 ring-black/5 rounded-2xl shadow-[0_18px_45px_-28px_rgba(15,23,42,0.35)] dark:from-slate-950/70 dark:via-slate-900/60 dark:to-slate-900/45 dark:supports-[backdrop-filter]:from-slate-950/60 dark:supports-[backdrop-filter]:via-slate-900/50 dark:supports-[backdrop-filter]:to-slate-900/40 dark:border-slate-700/60 dark:ring-white/5 dark:shadow-lg';
  const glassInputClass =
    'bg-white/75 border border-[#D9E6FF] backdrop-blur-lg font-semibold text-foreground/90 placeholder:text-[#9CA3AF] placeholder:opacity-100 focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:border-[#B7C8FF] dark:bg-slate-900/60 dark:border-slate-700/60 dark:text-slate-100 dark:placeholder:text-slate-400 dark:focus-visible:ring-primary/40 dark:focus-visible:border-slate-500/60';
  const apiUrl = API_URL;

  // Minimum deadline is 3 days from now
  const minDeadlineDate = startOfDay(addDays(new Date(), 3));
  const designerId = getDefaultDesignerId(scheduleTasks);
  const invalidRanges = useMemo(
    () => buildInvalidRanges(scheduleTasks, designerId),
    [designerId, scheduleTasks]
  );
  const isDateBlocked = (value: Date) =>
    !isEmergency &&
    invalidRanges.some((range) =>
      isWithinInterval(startOfDay(value), {
        start: startOfDay(range.start),
        end: startOfDay(range.end),
      })
    );
  const getNextAvailableDeadline = (baseDate: Date) => {
    let candidate = startOfDay(baseDate);
    if (!isEmergency && isBefore(candidate, minDeadlineDate)) {
      candidate = minDeadlineDate;
    }
    let attempts = 0;
    while (!isEmergency && isDateBlocked(candidate) && attempts < 120) {
      candidate = addDays(candidate, 1);
      attempts += 1;
    }
    return candidate;
  };

  useEffect(() => {
    if (!apiUrl) {
      setScheduleTasks([]);
      return;
    }
    let isActive = true;
    const loadSchedule = async () => {
      try {
        const response = await authFetch(`${apiUrl}/api/tasks`);
        if (!response.ok) {
          throw new Error('Failed to load tasks');
        }
        const data = await response.json();
        if (!isActive) return;
        setScheduleTasks(buildScheduleFromTasks(data));
      } catch {
        if (!isActive) return;
        setScheduleTasks([]);
      }
    };
    loadSchedule();
    return () => {
      isActive = false;
    };
  }, [apiUrl]);

  useEffect(() => {
    let isActive = true;

    const fetchAnimation = async (path: string) => {
      const response = await fetch(path);
      return response.ok ? response.json() : null;
    };

    Promise.all([
      fetchAnimation('/lottie/thank-you.json'),
      fetchAnimation('/lottie/upload-file.json'),
    ])
      .then(([thankYouData, uploadData]) => {
        if (!isActive) return;
        if (thankYouData) setThankYouAnimation(thankYouData);
        if (uploadData) setUploadAnimation(uploadData);
      })
      .catch(() => { });
    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    setRequesterPhone(user?.phone || '');
  }, [user]);

  useEffect(() => {
    if (defaultsApplied) return;
    const saved = localStorage.getItem('designhub:requestDefaults');
    if (!saved) return;
    try {
      const parsed = JSON.parse(saved);
      if (!category && parsed.category) {
        setCategory(parsed.category as TaskCategory);
      }
      if (parsed.urgency && urgency === 'normal') {
        setUrgency(parsed.urgency as TaskUrgency);
      }
      if (!deadline && typeof parsed.deadlineBufferDays === 'number') {
        const bufferDays = Math.max(0, parsed.deadlineBufferDays);
        setDeadline(getNextAvailableDeadline(addDays(new Date(), bufferDays)));
      }
      setDefaultsApplied(true);
    } catch {
      setDefaultsApplied(true);
    }
  }, [defaultsApplied, category, urgency, deadline]);

  useEffect(() => {
    if (hasDeadlineInteracted || !deadline || isEmergency) return;
    const normalized = startOfDay(deadline);
    const requiresMinLead = isBefore(normalized, minDeadlineDate);
    const blockedDate = isDateBlocked(normalized);
    if (!requiresMinLead && !blockedDate) return;
    const corrected = getNextAvailableDeadline(normalized);
    if (corrected.getTime() !== normalized.getTime()) {
      setDeadline(corrected);
    }
  }, [deadline, hasDeadlineInteracted, isEmergency, minDeadlineDate, invalidRanges]);

  const updateFile = (id: string, updates: Partial<UploadedFile>) => {
    setFiles((prev) =>
      prev.map((file) => (file.id === id ? { ...file, ...updates } : file))
    );
  };

  const uploadFileWithProgress = (file: File, localId: string) =>
    new Promise<void>((resolve) => {
      if (!apiUrl) {
        updateFile(localId, { uploading: false, progress: 100 });
        resolve();
        return;
      }

      const formData = new FormData();
      formData.append('file', file);

      const xhr = new XMLHttpRequest();
      xhr.open('POST', `${apiUrl}/api/files/upload`);
      const token = getAuthToken();
      if (token) {
        xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      }

      xhr.upload.onprogress = (event) => {
        if (!event.lengthComputable) return;
        const nextProgress = Math.round((event.loaded / event.total) * 100);
        updateFile(localId, {
          progress: nextProgress,
          uploading: nextProgress < 100,
        });
      };

      xhr.onload = () => {
        if (xhr.status < 200 || xhr.status >= 300) {
          let errorMsg = 'Upload failed';
          try {
            const errData = JSON.parse(xhr.responseText);
            errorMsg = errData.error || errData.message || errorMsg;
          } catch { }
          if (errorMsg === 'Upload failed') {
            errorMsg = xhr.status
              ? `Upload failed (HTTP ${xhr.status})`
              : 'Upload failed (Unknown error)';
          }

          updateFile(localId, { uploading: false, error: errorMsg });

          if (errorMsg.includes("Drive OAuth not connected")) {
            toast.error('Google Drive Disconnected', {
              description: 'Please authorize App to access Drive.',
              action: {
                label: 'Connect',
                onClick: async () => {
                  // Open in new tab
                  try {
                    const res = await authFetch(`${apiUrl}/api/drive/auth-url`);
                    const data = await res.json();
                    if (data.url) {
                      window.open(data.url, '_blank');
                    } else {
                      toast.error("Failed to get auth URL");
                    }
                  } catch (e) {
                    toast.error("Failed to get auth URL");
                  }
                }
              },
              duration: 10000,
            });
          } else {
            toast.error('File upload failed', { description: errorMsg });
          }

          resolve();
          return;
        }

        let data: {
          id?: string;
          webViewLink?: string;
          webContentLink?: string;
          size?: number | string;
          thumbnailLink?: string;
          extractedContent?: string;
        } | null =
          null;
        try {
          data = JSON.parse(xhr.responseText) as {
            id?: string;
            webViewLink?: string;
            webContentLink?: string;
            size?: number | string;
            thumbnailLink?: string;
          };
        } catch {
          data = null;
        }

        updateFile(localId, {
          driveId: data?.id,
          url: data?.webViewLink || data?.webContentLink,
          thumbnailUrl: data?.thumbnailLink,
          extractedContent: data?.extractedContent,
          uploading: false,
          progress: 100,
        });
        resolve();
      };

      xhr.onerror = () => {
        const errorMsg = 'Network error. Please check your connection.';
        updateFile(localId, { uploading: false, error: errorMsg });
        toast.error('File upload failed', { description: errorMsg });
        resolve();
      };

      xhr.send(formData);
    });

  const processFiles = async (selected: File[]) => {
    if (selected.length === 0) return;
    if (!apiUrl) {
      const newFiles = selected.map((file) => ({
        id: Math.random().toString(36).substr(2, 9),
        name: file.name,
        size: file.size,
        progress: 100,
      }));
      setFiles((prev) => [...prev, ...newFiles]);
      return;
    }

    const pending = selected.map((file) => ({
      id: Math.random().toString(36).substr(2, 9),
      name: file.name,
      size: file.size,
      uploading: true,
      progress: 0,
    }));
    setFiles((prev) => [...prev, ...pending]);

    await Promise.all(
      selected.map(async (file, index) => {
        const localId = pending[index].id;
        await uploadFileWithProgress(file, localId);
      })
    );
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFiles = e.target.files;
    if (!uploadedFiles) return;
    await processFiles(Array.from(uploadedFiles));
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = async (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
    const droppedFiles = Array.from(event.dataTransfer.files || []);
    await processFiles(droppedFiles);
  };

  const removeFile = (id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  // Task Buddy AI Handler
  const handleTaskBuddyDraft = (draft: TaskDraft) => {
    const aiResponse = draft;
    if (aiResponse) {
      applyAiDraft(aiResponse);
      toast.success('Task Buddy draft applied to form!');
      return;
    }
  };

  const isFormValid = () => {
    const hasUploadsInProgress = files.some((file) => file.uploading);
    const hasUploadErrors = files.some((file) => file.error);
    const deadlineValid =
      deadline &&
      (isEmergency || !isBefore(startOfDay(deadline), minDeadlineDate));
    return (
      title.trim() &&
      description.trim() &&
      category &&
      deadlineValid &&
      !hasUploadsInProgress &&
      !hasUploadErrors
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isFormValid()) {
      toast.error('Please complete all required fields', {
        description: 'Ensure all required fields are filled in.',
      });
      return;
    }

    setIsSubmitting(true);
    let fallbackToMock = false;
    const phoneInput = (requesterPhone.trim() || user?.phone || '').split(',').map(p => p.trim()).filter(Boolean);
    const phoneValue = phoneInput[0] || '';
    const secondaryPhones = phoneInput.slice(1);
    if (apiUrl) {
      try {
        const payload = {
          title,
          description,
          category,
          urgency,
          deadline: deadline as Date,
          status: 'pending',
          isEmergency,
          emergencyApprovalStatus: isEmergency ? 'pending' : undefined,
          emergencyRequestedAt: isEmergency ? new Date() : undefined,
          requesterId: user?.id || '',
          requesterName: user?.name || '',
          requesterEmail: user?.email || '',
          requesterPhone: phoneValue || undefined,
          secondaryPhones: secondaryPhones,
          requesterDepartment: user?.department || '',
          designVersions: [],
          files: files.map((file) => ({
            name: file.name,
            url: file.url || '',
            type: 'input',
            size: file.size,
            thumbnailUrl: file.thumbnailUrl,
            uploadedAt: new Date(),
            uploadedBy: user?.id || '',
          })),
        };
        const response = await authFetch(`${apiUrl}/api/tasks`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!response.ok) {
          throw new Error('Request failed');
        }
      } catch {
        fallbackToMock = true;
      }
    }
    if (isEmergency) {
      toast.message('Emergency request sent for designer approval.');
    }

    if (!apiUrl || fallbackToMock) {
      const now = new Date();
      const createdChange: TaskChange = {
        id: `ch-${Date.now()}-0`,
        type: 'status',
        field: 'created',
        oldValue: undefined,
        newValue: 'Created',
        note: `New request submitted by ${user?.name || 'Staff'}`,
        userId: user?.id || '',
        userName: user?.name || 'Staff',
        userRole: user?.role || 'staff',
        createdAt: now,
      };
      const localTask: Task = {
        id: crypto.randomUUID(),
        title: title.trim(),
        description: description.trim(),
        category: category as TaskCategory,
        urgency,
        status: 'pending',
        isEmergency,
        emergencyApprovalStatus: isEmergency ? 'pending' : undefined,
        emergencyRequestedAt: isEmergency ? now : undefined,
        requesterId: user?.id || '',
        requesterName: user?.name || 'Staff',
        requesterEmail: user?.email,
        requesterPhone: phoneValue || undefined,
        requesterDepartment: user?.department,
        deadline: deadline as Date,
        isModification: false,
        changeCount: 0,
        changeHistory: [createdChange],
        designVersions: [],
        files: files.map((file) => ({
          id: file.driveId || file.id,
          name: file.name,
          url: file.url || '',
          type: 'input',
          size: file.size,
          thumbnailUrl: file.thumbnailUrl,
          uploadedAt: now,
          uploadedBy: user?.id || '',
        })),
        comments: [],
        createdAt: now,
        updatedAt: now,
      };
      upsertLocalTask(localTask);
    }

    if (!apiUrl || fallbackToMock) {
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }

    setIsSubmitting(false);
    setShowThankYou(true);
  };

  const handleThankYouClose = () => {
    setShowThankYou(false);
    navigate('/my-requests');
  };

  const openExistingUploader = () => {
    const uploader = document.getElementById('file-upload') as HTMLInputElement | null;
    uploader?.click();
  };

  useEffect(() => {
    const handleOpenUploader = () => {
      openExistingUploader();
    };
    window.addEventListener('designhub:open-uploader', handleOpenUploader);
    return () => {
      window.removeEventListener('designhub:open-uploader', handleOpenUploader);
    };
  }, []);

  return (
    <DashboardLayout
      background={
        <div className="pointer-events-none absolute inset-0 -z-10 bg-white dark:bg-slate-950 overflow-hidden rounded-[32px]">
          <div className="absolute left-1/2 top-[-22%] h-[680px] w-[780px] -translate-x-1/2 rounded-[50%] bg-[radial-gradient(ellipse_at_center,_rgba(77,92,218,0.6),_rgba(120,190,255,0.4)_45%,_transparent_72%)] blur-[90px] opacity-90 dark:opacity-0" />
          <div className="absolute left-[10%] bottom-[-20%] h-[520px] w-[620px] rounded-[50%] bg-[radial-gradient(ellipse_at_center,_rgba(120,190,255,0.35),_transparent_70%)] blur-[110px] opacity-70 dark:opacity-0" />
        </div>
      }
    >
      <div className="max-w-3xl mx-auto space-y-6 pt-8">
        {/* Header */}
        <div className="animate-fade-in flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground premium-headline">New Design Request</h1>
            <p className="text-muted-foreground mt-1 premium-body">
              Submit a new design request to the team
            </p>
          </div>
          <GeminiBlink onClick={() => setIsTaskBuddyOpen(true)} />
        </div>

        {/* Guidelines Banner */}
        {showGuidelines && (
          <div className={`${glassPanelClass} p-5 animate-slide-up relative text-foreground`}>
            <button
              onClick={() => setShowGuidelines(false)}
              className="absolute top-3 right-3 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
            <div className="flex items-start gap-3">
              <Info className="h-5 w-5 text-accent flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-foreground mb-2">
                  Submission Guidelines
                </h3>
                <ul className="space-y-2 text-sm text-foreground/80">
                  <li className="flex items-start gap-2">
                    <span className="material-symbols-outlined mt-1 text-base text-foreground/70 flex-shrink-0">
                      database
                    </span>
                    <span>
                      <strong>Data Requirements:</strong> Include all text content,
                      images, logos, and reference files
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="material-symbols-outlined mt-1 text-base text-foreground/70 flex-shrink-0">
                      schedule
                    </span>
                    <span>
                      <strong>Timeline:</strong> Minimum 3 working days for standard
                      requests. Urgent requests require justification.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="material-symbols-outlined mt-1 text-base text-foreground/70 flex-shrink-0">
                      edit
                    </span>
                    <span>
                      <strong>Modifications:</strong> Changes to approved designs
                      require Treasurer approval first
                    </span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className={`${glassPanelClass} p-6 pb-8 min-h-[520px] space-y-5 animate-slide-up`}>
            {/* Title */}
            <div className="space-y-2">
              <Label htmlFor="title">
                Request Title <span className="text-destructive">*</span>
              </Label>
              <Input
                id="title"
                placeholder="e.g., Annual Report Cover Design"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className={`h-11 ${glassInputClass}`}
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description">
                Description <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="description"
                placeholder="Provide detailed requirements, specifications, and any special instructions..."
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className={`${glassInputClass} min-h-[120px]`}
              />
            </div>

            {/* Category & Urgency */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>
                  Category <span className="text-destructive">*</span>
                </Label>
                <Select value={category} onValueChange={(v) => setCategory(v as TaskCategory)}>
                  <SelectTrigger className={`h-11 ${glassInputClass}`}>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent className="border border-[#C9D7FF] bg-[#F2F6FF]/95 supports-[backdrop-filter]:bg-[#F2F6FF]/70 backdrop-blur-xl shadow-lg dark:border-slate-700/60 dark:bg-slate-900/90 dark:text-slate-100 dark:supports-[backdrop-filter]:bg-slate-900/70">
                    {categoryOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        <div className="flex items-center gap-2">
                          <option.icon className="h-4 w-4 text-muted-foreground" />
                          <span>{option.label}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Urgency</Label>
                <Select value={urgency} onValueChange={(v) => setUrgency(v as TaskUrgency)}>
                  <SelectTrigger className={`h-11 ${glassInputClass}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="border border-[#C9D7FF] bg-[#F2F6FF]/95 supports-[backdrop-filter]:bg-[#F2F6FF]/70 backdrop-blur-xl shadow-lg dark:border-slate-700/60 dark:bg-slate-900/90 dark:text-slate-100 dark:supports-[backdrop-filter]:bg-slate-900/70">
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="intermediate">Intermediate</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center justify-between rounded-xl border border-[#D9E6FF] bg-white/70 px-4 py-3 dark:border-slate-700/60 dark:bg-slate-900/60">
              <div>
                <p className="text-sm font-semibold text-foreground">Emergency override</p>
                <p className="text-xs text-muted-foreground">
                  Requires designer approval
                </p>
              </div>
              <Switch checked={isEmergency} onCheckedChange={setIsEmergency} />
            </div>
            {isEmergency && (
              <p className="text-xs text-status-urgent">
                Emergency requests can bypass blocked dates but must be approved.
              </p>
            )}

            {/* Deadline */}
            <div className="space-y-2">
              <Label htmlFor="deadline">
                Deadline <span className="text-destructive">*</span>
              </Label>
              <div className="relative">
                <LocalizationProvider dateAdapter={AdapterDateFns}>
                  <DatePicker
                    value={deadline}
                    onChange={(newValue) => {
                      setHasDeadlineInteracted(true);
                      setDeadline(newValue);
                    }}
                    minDate={isEmergency ? undefined : minDeadlineDate}
                    shouldDisableDate={isDateBlocked}
                    slotProps={{
                      textField: {
                        size: 'small',
                        fullWidth: true,
                        sx: {
                          '& .MuiPickersOutlinedInput-root': {
                            borderRadius: 'var(--radius)',
                            height: 44,
                            backgroundColor: 'rgba(255, 255, 255, 0.75)',
                            backdropFilter: 'blur(12px)',
                            fontWeight: 500,
                            color: 'hsl(var(--foreground) / 0.9)',
                            fontSize: '0.875rem',
                          },
                          '& .MuiPickersOutlinedInput-notchedOutline': {
                            borderColor: '#D9E6FF',
                          },
                          '&:hover .MuiPickersOutlinedInput-notchedOutline': {
                            borderColor: '#B7C8FF',
                          },
                          '& .MuiPickersOutlinedInput-root.Mui-focused .MuiPickersOutlinedInput-notchedOutline':
                          {
                            borderColor: '#B7C8FF',
                          },
                          '& .MuiPickersOutlinedInput-root.Mui-focused': {
                            boxShadow: '0 0 0 3px rgba(59, 130, 246, 0.18)',
                          },
                          '& .MuiPickersInputBase-input': {
                            padding: '0 14px',
                            fontWeight: 500,
                            fontSize: '0.875rem',
                          },
                          '& .MuiPickersInputBase-sectionContent': {
                            fontWeight: 500,
                            color: 'hsl(var(--foreground) / 0.9)',
                            fontSize: '0.875rem',
                          },
                          '& .MuiPickersInputBase-input::placeholder': {
                            color: '#9CA3AF',
                            opacity: 1,
                          },
                          '& .MuiSvgIcon-root': {
                            color: 'hsl(var(--muted-foreground))',
                          },
                        },
                      },
                    }}
                  />
                </LocalizationProvider>
              </div>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {isEmergency
                  ? 'Emergency requests can bypass the 3-day minimum'
                  : 'Minimum 3 days from today'}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="requester-phone">Phone (WhatsApp updates)</Label>
              <Input
                id="requester-phone"
                type="tel"
                placeholder="+18005551234"
                value={requesterPhone}
                onChange={(event) => setRequesterPhone(event.target.value)}
                className={`h-11 ${glassInputClass}`}
              />
              <p className="text-xs text-muted-foreground">
                Optional. Use commas for multiple numbers (e.g., +1234567890, +0987654321).
              </p>
            </div>

          </div>

          {/* File Upload */}
          <div className={`${glassPanelClass} p-6 space-y-4 animate-slide-up`}>
            <div>
              <Label>
                Attachments <span className="text-muted-foreground">(Optional)</span>
              </Label>
              <p className="text-sm text-muted-foreground mt-1">
                Upload any supporting content, reference files, and data
              </p>
            </div>

            <div
              className={`border-2 border-dashed rounded-lg p-8 pb-10 text-center transition-colors ${isDragging
                ? 'border-primary/60 bg-white/80 dark:border-primary/50 dark:bg-slate-900/70'
                : 'border-border bg-white/70 hover:border-primary/50 dark:border-slate-700/60 dark:bg-slate-900/50 dark:hover:border-slate-500/50'
                }`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <input
                type="file"
                multiple
                onChange={handleFileUpload}
                className="hidden"
                id="file-upload"
              />
              <label htmlFor="file-upload" className="cursor-pointer">
                {uploadAnimation ? (
                  <Lottie
                    animationData={uploadAnimation}
                    loop
                    className="h-24 w-24 mx-auto mb-3"
                  />
                ) : (
                  <Upload className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                )}
                <p className="font-medium text-foreground">
                  Click to upload or drag and drop
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  PDF, DOC, PNG, JPG, ZIP up to 50MB each
                </p>
              </label>
            </div>

            {files.length > 0 && (
              <div className="space-y-2">
                {files.map((file) => (
                  <div
                    key={file.id}
                    className="flex items-center justify-between rounded-lg border border-[#D7E3FF] bg-gradient-to-r from-[#F4F8FF]/90 via-[#EEF4FF]/70 to-[#E6F1FF]/80 px-4 py-3 supports-[backdrop-filter]:bg-[#EEF4FF]/60 backdrop-blur-xl dark:border-slate-700/60 dark:bg-none dark:bg-slate-900/60 dark:supports-[backdrop-filter]:bg-slate-900/60"
                  >
                    <div className="flex items-start gap-3 flex-1">
                      {getFileIcon(file.name, 'h-5 w-5 text-primary')}
                      <div className="flex-1">
                        <p className="text-sm font-medium text-foreground">
                          {file.name}
                        </p>
                        <div className="flex items-center gap-2">
                          <p className={`text-xs ${file.error ? 'text-destructive' : 'text-muted-foreground'}`}>
                            {file.uploading
                              ? 'Uploading...'
                              : file.error
                                ? file.error
                                : formatFileSize(file.size)}
                          </p>
                          {file.error && file.error.includes("Drive OAuth not connected") && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-6 px-2 text-xs border-destructive text-destructive hover:bg-destructive hover:text-white"
                              onClick={async (e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                try {
                                  const apiUrl = API_URL;
                                  const res = await authFetch(`${apiUrl}/api/drive/auth-url`);
                                  const data = await res.json();
                                  if (data.url) {
                                    window.open(data.url, '_blank');
                                  } else {
                                    toast.error("Failed to get auth URL");
                                  }
                                } catch (e) {
                                  toast.error("Failed to get auth URL");
                                }
                              }}
                            >
                              Connect
                            </Button>
                          )}
                        </div>
                        {file.uploading && typeof file.progress === 'number' && (
                          <div className="mt-2 w-full max-w-sm">
                            <LinearProgressWithLabel value={file.progress} />
                          </div>
                        )}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeFile(file.id)}
                      className="text-muted-foreground hover:text-destructive transition-colors"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Submit Button */}
          <div className="flex items-center justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate('/dashboard')}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!isFormValid() || isSubmitting}>
              {isSubmitting ? 'Submitting...' : 'Submit Request'}
            </Button>
          </div>
        </form>
      </div>
      <Dialog open={showThankYou} onOpenChange={(open) => (!open ? handleThankYouClose() : null)}>
        <DialogContent className="max-w-md overflow-hidden p-0">
          <div className="relative h-44 bg-primary/10">
            {thankYouAnimation && (
              <Lottie
                animationData={thankYouAnimation}
                loop={10}
                className="h-full w-full"
              />
            )}
          </div>
          <div className="px-7 pb-7 pt-5 text-center">
            <DialogHeader className="text-center sm:text-center">
              <DialogTitle className="text-2xl font-bold text-foreground premium-headline">Thank you!</DialogTitle>
              <DialogDescription className="mt-2.5 text-sm text-muted-foreground">
                Your request has been successfully submitted.
                <br />
                Our design team will review it shortly.
              </DialogDescription>
            </DialogHeader>
            <Button className="mt-8 w-full" onClick={handleThankYouClose}>
              Close
            </Button>
            <div className="mt-6 border-t border-border/60 pt-4 pb-2 text-center text-[11px] text-muted-foreground">
              For assistance, please contact the coordinator at{' '}
              <a href="tel:+910000000000" className="font-medium text-foreground/80 hover:text-foreground">
                +91 0000000000
              </a>{' '}
              or{' '}
              <a
                href="mailto:support@designdesk.com"
                className="font-medium text-foreground/80 hover:text-foreground"
              >
                support@designdesk.com
              </a>
              .
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Task Buddy AI Modal */}
      <TaskBuddyModal
        isOpen={isTaskBuddyOpen}
        onClose={() => setIsTaskBuddyOpen(false)}
        onTaskCreated={handleTaskBuddyDraft}
        onOpenUploader={openExistingUploader}
        hasAttachments={files.length > 0}
        attachmentContext={files
          .map((file) => file.extractedContent || file.name)
          .filter(Boolean)
          .join('\n\n')}
      />
    </DashboardLayout >
  );
}
