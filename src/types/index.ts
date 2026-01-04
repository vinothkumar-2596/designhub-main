export type UserRole = 'designer' | 'staff' | 'treasurer';

export type TaskStatus = 
  | 'pending'
  | 'in_progress'
  | 'clarification_required'
  | 'under_review'
  | 'completed';

export type TaskCategory =
  | 'banner'
  | 'campaign_or_others'
  | 'social_media_creative'
  | 'website_assets'
  | 'ui_ux'
  | 'led_backdrop'
  | 'brochure'
  | 'flyer';

export type TaskUrgency = 'low' | 'intermediate' | 'normal' | 'urgent';

export type ApprovalStatus = 'pending' | 'approved' | 'rejected';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar?: string;
  department?: string;
  phone?: string;
}

export interface TaskComment {
  id: string;
  taskId: string;
  userId: string;
  userName: string;
  userRole?: UserRole;
  content: string;
  parentId?: string;
  mentions?: UserRole[];
  createdAt: Date;
  receiverRoles?: UserRole[];
  seenBy?: CommentSeen[];
}

export interface CommentSeen {
  role: UserRole;
  seenAt: Date;
}

export interface TaskFile {
  id: string;
  name: string;
  url: string;
  type: 'input' | 'output';
  uploadedAt: Date;
  uploadedBy: string;
  size?: number;
  thumbnailUrl?: string;
}

export interface DesignVersion {
  id: string;
  name: string;
  url: string;
  version: number;
  uploadedAt: Date;
  uploadedBy: string;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  category: TaskCategory;
  urgency: TaskUrgency;
  status: TaskStatus;
  isEmergency?: boolean;
  emergencyApprovalStatus?: 'pending' | 'approved' | 'rejected';
  emergencyApprovedBy?: string;
  emergencyApprovedAt?: Date;
  emergencyRequestedAt?: Date;
  scheduleTaskId?: string;
  requesterId: string;
  requesterName: string;
  requesterEmail?: string;
  requesterPhone?: string;
  requesterDepartment?: string;
  assignedTo?: string;
  assignedToName?: string;
  deadline: Date;
  proposedDeadline?: Date;
  deadlineApprovalStatus?: 'pending' | 'approved' | 'rejected';
  deadlineApprovedBy?: string;
  deadlineApprovedAt?: Date;
  isModification: boolean;
  approvalStatus?: ApprovalStatus;
  approvedBy?: string;
  approvalDate?: Date;
  changeCount: number;
  changeHistory: TaskChange[];
  files: TaskFile[];
  designVersions?: DesignVersion[];
  activeDesignVersionId?: string;
  comments: TaskComment[];
  createdAt: Date;
  updatedAt: Date;
}

export interface TaskChange {
  id: string;
  type: 'update' | 'file_added' | 'file_removed' | 'status';
  field: string;
  oldValue?: string;
  newValue?: string;
  note?: string;
  userId: string;
  userName: string;
  userRole: UserRole;
  createdAt: Date;
}

export interface DashboardStats {
  totalTasks: number;
  pendingTasks: number;
  inProgressTasks: number;
  completedTasks: number;
  urgentTasks: number;
  pendingApprovals: number;
}
