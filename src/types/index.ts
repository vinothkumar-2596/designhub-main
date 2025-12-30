export type UserRole = 'admin' | 'designer' | 'staff' | 'treasurer';

export type TaskStatus = 
  | 'pending'
  | 'in_progress'
  | 'clarification_required'
  | 'under_review'
  | 'completed';

export type TaskCategory = 
  | 'poster'
  | 'social_media'
  | 'banner'
  | 'brochure'
  | 'others';

export type TaskUrgency = 'normal' | 'urgent';

export type ApprovalStatus = 'pending' | 'approved' | 'rejected';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar?: string;
  department?: string;
}

export interface TaskComment {
  id: string;
  taskId: string;
  userId: string;
  userName: string;
  userRole: UserRole;
  content: string;
  createdAt: Date;
}

export interface TaskFile {
  id: string;
  name: string;
  url: string;
  type: 'input' | 'output';
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
  requesterId: string;
  requesterName: string;
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
