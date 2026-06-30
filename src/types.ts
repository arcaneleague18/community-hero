export type Role = 'Citizen' | 'Verifier' | 'Admin' | 'Banned';

export interface PointHistoryEntry {
  amount: number;
  reason: string;
  date: string;
}

export interface User {
  id: string;
  name: string;
  email?: string;
  role: Role;
  points: number;
  badges: string[];
  pointsHistory?: PointHistoryEntry[];
}

export interface Complaint {
  id: string;
  imageBase64: string;
  latitude: number;
  longitude: number;
  landmark: string;
  region?: string;
  description: string;
  category?: string;
  status: 'Pending' | 'Verified' | 'In Progress' | 'Resolved' | 'Rejected';
  createdAt?: any;
  upvotedBy?: string[];
  userId?: string;
  assignedTo?: string;
  statusUpdatedBy?: string[];
  rejectionReason?: string;
}
