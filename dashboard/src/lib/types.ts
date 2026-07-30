export interface LoginResponse {
  access_token: string;
  token_type: string;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  method: string;
  path: string;
  status_code: number;
  user_id: string | null;
  ip_address: string | null;
  response_time_ms: number | null;
}

export interface Alert extends AuditLog {}

export interface StatsData {
  total_requests: number;
  error_count: number;
  auth_failures: number;
  error_rate: number;
}

export interface User {
  id: string;
  username: string;
  role: string;
  is_active: boolean;
}
