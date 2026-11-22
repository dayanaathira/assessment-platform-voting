// Mirrors the API DTOs. Dates arrive as ISO strings.

export interface ApiResponse<T> {
  statusCode: number;
  data: T;
  message?: string;
}

export interface ApiError {
  statusCode: number;
  error: string;
  message: string | string[];
  path: string;
  timestamp: string;
}

export interface Page<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

export interface Tokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthUser {
  id: string;
  name: string;
  roles: string[];
}

export interface User {
  id: string;
  name: string;
  username: string;
}

export interface Status {
  id: number;
  name: string;
}

export interface MergedRequest {
  id: string;
  title: string;
}

export interface MergedInto extends MergedRequest {
  mergedAt: string;
  mergedBy: User;
}

export interface FeatureRequest {
  id: string;
  title: string;
  description: string;
  status: Status;
  voteCount: number;
  commentCount: number;
  officialResponse?: string;
  officialResponseAt?: string;
  officialResponseBy?: User;
  hasVoted: boolean;
  canVote: boolean;
  mergedInto?: MergedInto | null;
  mergedFrom?: MergedRequest[];
  createdBy: User;
  createdAt: string;
  updatedAt?: string;
}

export type FeatureRequestSort = 'votes' | 'new';

export interface FeatureRequestQuery {
  q?: string;
  status?: number;
  fromDate?: string;
  toDate?: string;
  sort?: FeatureRequestSort;
  limit?: number;
  offset?: number;
}

export interface VoteResult {
  voteCount: number;
  hasVoted: boolean;
}

export interface Comment {
  id: string;
  body: string;
  user: User;
  createdAt: string;
}

export interface RequestMerge {
  id: string;
  sourceRequestId: string;
  targetRequestId: string;
  votesMoved: number;
  commentsMoved: number;
  createdAt: string;
}

export interface ReportRequest {
  id: string;
  title: string;
  voteCount: number;
  commentCount: number;
  status?: Status;
  createdBy?: User;
  createdAt: string;
}

export interface Report {
  totals: { requests: number; votes: number; comments: number };
  byStatus: (Status & { count: number })[];
  topVoted: ReportRequest[];
  needsReview: ReportRequest[];
}
