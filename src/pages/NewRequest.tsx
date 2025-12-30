import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertTriangle,
  Upload,
  FileText,
  Calendar,
  Clock,
  CheckCircle2,
  Info,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { TaskCategory, TaskUrgency } from '@/types';
import { addDays, format, isAfter, isBefore, addBusinessDays } from 'date-fns';

interface UploadedFile {
  id: string;
  name: string;
  size: number;
}

export default function NewRequest() {
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showGuidelines, setShowGuidelines] = useState(true);
  
  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<TaskCategory | ''>('');
  const [urgency, setUrgency] = useState<TaskUrgency>('normal');
  const [deadline, setDeadline] = useState('');
  const [isModification, setIsModification] = useState(false);
  const [files, setFiles] = useState<UploadedFile[]>([]);

  // Minimum deadline is 3 working days from now
  const minDeadline = format(addBusinessDays(new Date(), 3), 'yyyy-MM-dd');

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFiles = e.target.files;
    if (uploadedFiles) {
      const newFiles = Array.from(uploadedFiles).map((file) => ({
        id: Math.random().toString(36).substr(2, 9),
        name: file.name,
        size: file.size,
      }));
      setFiles([...files, ...newFiles]);
    }
  };

  const removeFile = (id: string) => {
    setFiles(files.filter((f) => f.id !== id));
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const isFormValid = () => {
    return (
      title.trim() &&
      description.trim() &&
      category &&
      deadline &&
      files.length > 0 &&
      !isBefore(new Date(deadline), new Date(minDeadline))
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!isFormValid()) {
      toast.error('Please complete all required fields', {
        description: 'Ensure all fields are filled and at least one file is uploaded.',
      });
      return;
    }

    setIsSubmitting(true);

    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1500));

    toast.success('Request submitted successfully!', {
      description: isModification
        ? 'Your request has been sent to the Treasurer for approval.'
        : 'Your request has been added to the design queue.',
    });

    navigate('/my-requests');
  };

  return (
    <DashboardLayout>
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
          <div className="bg-primary/5 border border-primary/20 rounded-xl p-5 animate-slide-up relative">
            <button
              onClick={() => setShowGuidelines(false)}
              className="absolute top-3 right-3 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
            <div className="flex items-start gap-3">
              <Info className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-foreground mb-2">
                  Submission Guidelines
                </h3>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-status-completed flex-shrink-0 mt-0.5" />
                    <span>
                      <strong>Data Requirements:</strong> Include all text content,
                      images, logos, and reference files
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-status-completed flex-shrink-0 mt-0.5" />
                    <span>
                      <strong>Timeline:</strong> Minimum 3 working days for standard
                      requests. Urgent requests require justification.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-status-completed flex-shrink-0 mt-0.5" />
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
          <div className="bg-card border border-border rounded-xl p-6 space-y-5 animate-slide-up">
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
              />
            </div>

            {/* Category & Urgency */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>
                  Category <span className="text-destructive">*</span>
                </Label>
                <Select value={category} onValueChange={(v) => setCategory(v as TaskCategory)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="poster">Poster</SelectItem>
                    <SelectItem value="social_media">Social Media</SelectItem>
                    <SelectItem value="banner">Banner</SelectItem>
                    <SelectItem value="brochure">Brochure</SelectItem>
                    <SelectItem value="others">Others</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Urgency</Label>
                <Select value={urgency} onValueChange={(v) => setUrgency(v as TaskUrgency)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Deadline */}
            <div className="space-y-2">
              <Label htmlFor="deadline">
                Deadline <span className="text-destructive">*</span>
              </Label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="deadline"
                  type="date"
                  min={minDeadline}
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                  className="pl-10"
                />
              </div>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Minimum 3 working days from submission date
              </p>
            </div>

            {/* Modification Checkbox */}
            <div className="flex items-start space-x-3 pt-2">
              <Checkbox
                id="modification"
                checked={isModification}
                onCheckedChange={(checked) => setIsModification(checked as boolean)}
              />
              <div className="space-y-1">
                <Label
                  htmlFor="modification"
                  className="font-medium cursor-pointer"
                >
                  This is a modification of an approved design
                </Label>
                <p className="text-xs text-muted-foreground">
                  Modifications require Treasurer approval before processing
                </p>
              </div>
            </div>

            {isModification && (
              <div className="bg-status-pending-bg border border-status-pending/20 rounded-lg p-4 flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-status-pending flex-shrink-0" />
                <div className="text-sm">
                  <p className="font-medium text-foreground">Approval Required</p>
                  <p className="text-muted-foreground mt-1">
                    This request will be sent to the Treasurer for approval before
                    being assigned to a designer.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* File Upload */}
          <div className="bg-card border border-border rounded-xl p-6 space-y-4 animate-slide-up">
            <div>
              <Label>
                Attachments <span className="text-destructive">*</span>
              </Label>
              <p className="text-sm text-muted-foreground mt-1">
                Upload all required content, reference files, and data
              </p>
            </div>

            <div className="border-2 border-dashed border-border rounded-lg p-8 text-center hover:border-primary/50 transition-colors">
              <input
                type="file"
                multiple
                onChange={handleFileUpload}
                className="hidden"
                id="file-upload"
              />
              <label htmlFor="file-upload" className="cursor-pointer">
                <Upload className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
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
                    className="flex items-center justify-between bg-secondary/50 rounded-lg px-4 py-3"
                  >
                    <div className="flex items-center gap-3">
                      <FileText className="h-5 w-5 text-primary" />
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          {file.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatFileSize(file.size)}
                        </p>
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
    </DashboardLayout>
  );
}
