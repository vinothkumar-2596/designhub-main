import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
} from 'lucide-react';
import { toast } from 'sonner';
import { Task, TaskCategory, TaskUrgency } from '@/types';
import { addDays, isBefore, isWithinInterval, startOfDay } from 'date-fns';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import Box from '@mui/material/Box';
import LinearProgress, { LinearProgressProps } from '@mui/material/LinearProgress';
import Typography from '@mui/material/Typography';
import { useAuth } from '@/contexts/AuthContext';
import {
  assignEmergencyTask,
  assignTask,
  buildInvalidRanges,
  getDefaultDesignerId,
  loadScheduleTasks,
  recordScheduleRequest,
  saveScheduleTasks,
} from '@/lib/designerSchedule';
import { seedScheduleTasks } from '@/data/designerSchedule';
import { upsertLocalTask } from '@/lib/taskStorage';

interface UploadedFile {
  id: string;
  name: string;
  size: number;
  driveId?: string;
  url?: string;
  uploading?: boolean;
  progress?: number;
  error?: string;
}

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

const priorityFromUrgency = (value: TaskUrgency) => {
  if (value === 'urgent') return 'VIP';
  if (value === 'intermediate') return 'HIGH';
  return 'NORMAL';
};

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

export default function NewRequest() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showGuidelines, setShowGuidelines] = useState(true);
  const [showThankYou, setShowThankYou] = useState(false);
  const [thankYouAnimation, setThankYouAnimation] = useState<object | null>(null);
  const [uploadAnimation, setUploadAnimation] = useState<object | null>(null);
  
  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<TaskCategory | ''>('');
  const [urgency, setUrgency] = useState<TaskUrgency>('normal');
  const [deadline, setDeadline] = useState<Date | null>(null);
  const [isEmergency, setIsEmergency] = useState(false);
  const [requesterPhone, setRequesterPhone] = useState(user?.phone || '');
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [scheduleTasks, setScheduleTasks] = useState(() =>
    loadScheduleTasks(seedScheduleTasks)
  );
  const glassPanelClass =
    'bg-gradient-to-br from-white/85 via-white/70 to-[#E6F1FF]/75 supports-[backdrop-filter]:from-white/65 supports-[backdrop-filter]:via-white/55 supports-[backdrop-filter]:to-[#E6F1FF]/60 backdrop-blur-2xl border border-[#C9D7FF] ring-1 ring-black/5 rounded-2xl shadow-[0_18px_45px_-28px_rgba(15,23,42,0.35)]';
  const glassInputClass =
    'bg-white/75 border border-[#D9E6FF] backdrop-blur-lg font-semibold text-foreground/90 placeholder:text-[#9CA3AF] placeholder:opacity-100 focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:border-[#B7C8FF]';
  const apiUrl =
    (import.meta.env.VITE_API_URL as string | undefined) ||
    (typeof window !== 'undefined' && window.location.hostname === 'localhost'
      ? 'http://localhost:4000'
      : undefined);

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
      .catch(() => {});
    return () => {
      isActive = false;
    };
    }, []);

  useEffect(() => {
    setRequesterPhone(user?.phone || '');
  }, [user]);

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
          updateFile(localId, { uploading: false, error: 'Upload failed' });
          toast.error('File upload failed', { description: file.name });
          resolve();
          return;
        }

        let data: { id?: string; webViewLink?: string; webContentLink?: string } | null =
          null;
        try {
          data = JSON.parse(xhr.responseText) as {
            id?: string;
            webViewLink?: string;
            webContentLink?: string;
          };
        } catch {
          data = null;
        }

        updateFile(localId, {
          driveId: data?.id,
          url: data?.webViewLink || data?.webContentLink,
          uploading: false,
          progress: 100,
        });
        resolve();
      };

      xhr.onerror = () => {
        updateFile(localId, { uploading: false, error: 'Upload failed' });
        toast.error('File upload failed', { description: file.name });
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
      const phoneValue = requesterPhone.trim() || user?.phone || '';
      const nextScheduleTasks = isEmergency
        ? assignEmergencyTask(scheduleTasks, designerId, title, deadline ?? undefined)
        : assignTask(
          scheduleTasks,
          designerId,
          title,
          deadline ?? undefined,
          priorityFromUrgency(urgency)
        );
    const createdScheduleTask = nextScheduleTasks.find(
      (task) => !scheduleTasks.some((previous) => previous.id === task.id)
    );

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
          scheduleTaskId: createdScheduleTask?.id,
            requesterId: user?.id || '',
            requesterName: user?.name || '',
            requesterEmail: user?.email || '',
            requesterPhone: phoneValue || undefined,
            requesterDepartment: user?.department || '',
            designVersions: [],
            files: files.map((file) => ({
              name: file.name,
              url: file.url || '',
              type: 'input',
            uploadedAt: new Date(),
            uploadedBy: user?.id || '',
          })),
        };
        const response = await fetch(`${apiUrl}/api/tasks`, {
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

    setScheduleTasks(nextScheduleTasks);
    saveScheduleTasks(nextScheduleTasks);
    if (createdScheduleTask && user) {
      recordScheduleRequest(createdScheduleTask.id, user.id, user.name);
    }
    if (isEmergency) {
      toast.message('Emergency request sent for designer approval.');
    }

    if (!apiUrl || fallbackToMock) {
      const now = new Date();
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
        scheduleTaskId: createdScheduleTask?.id,
          requesterId: user?.id || '',
          requesterName: user?.name || 'Staff',
          requesterEmail: user?.email,
          requesterPhone: phoneValue || undefined,
          requesterDepartment: user?.department,
        deadline: deadline as Date,
          isModification: false,
          changeCount: 0,
          changeHistory: [],
          designVersions: [],
          files: files.map((file) => ({
            id: file.driveId || file.id,
            name: file.name,
          url: file.url || '',
          type: 'input',
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

  return (
    <DashboardLayout>
      <div className="relative">
        <div className="pointer-events-none absolute inset-0 -z-10 w-screen left-1/2 -translate-x-1/2 bg-white">
          <div className="absolute left-1/2 top-[-22%] h-[680px] w-[780px] -translate-x-1/2 rounded-[50%] bg-[radial-gradient(ellipse_at_center,_rgba(77,92,218,0.6),_rgba(120,190,255,0.4)_45%,_transparent_72%)] blur-[90px] opacity-90" />
          <div className="absolute left-[10%] bottom-[-20%] h-[520px] w-[620px] rounded-[50%] bg-[radial-gradient(ellipse_at_center,_rgba(120,190,255,0.35),_transparent_70%)] blur-[110px] opacity-70" />
        </div>
        <div className="max-w-3xl mx-auto space-y-6">
        {/* Header */}
        <div className="animate-fade-in">
          <h1 className="text-2xl font-bold text-foreground">New Design Request</h1>
          <p className="text-muted-foreground mt-1">
            Submit a new design request to the team
          </p>
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
                  <SelectContent className="border border-[#C9D7FF] bg-[#F2F6FF]/95 supports-[backdrop-filter]:bg-[#F2F6FF]/70 backdrop-blur-xl shadow-lg">
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
                  <SelectContent className="border border-[#C9D7FF] bg-[#F2F6FF]/95 supports-[backdrop-filter]:bg-[#F2F6FF]/70 backdrop-blur-xl shadow-lg">
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="intermediate">Intermediate</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center justify-between rounded-xl border border-[#D9E6FF] bg-white/70 px-4 py-3">
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
                    onChange={(newValue) => setDeadline(newValue)}
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
                  Optional. Leave blank to use your profile phone number.
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
              className={`border-2 border-dashed rounded-lg p-8 pb-10 text-center transition-colors ${
                isDragging
                  ? 'border-primary/60 bg-white/80'
                  : 'border-border bg-white/70 hover:border-primary/50'
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
                    className="flex items-center justify-between rounded-lg border border-[#D7E3FF] bg-gradient-to-r from-[#F4F8FF]/90 via-[#EEF4FF]/70 to-[#E6F1FF]/80 px-4 py-3 supports-[backdrop-filter]:bg-[#EEF4FF]/60 backdrop-blur-xl"
                  >
                    <div className="flex items-start gap-3 flex-1">
                      {getFileIcon(file.name, 'h-5 w-5 text-primary')}
                      <div className="flex-1">
                        <p className="text-sm font-medium text-foreground">
                          {file.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {file.uploading
                            ? 'Uploading...'
                            : file.error
                              ? file.error
                              : formatFileSize(file.size)}
                        </p>
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
              <DialogTitle className="text-2xl font-bold text-foreground">Thank you!</DialogTitle>
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
    </DashboardLayout>
  );
}
