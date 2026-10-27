export type AppIdentity = {
  id: string;
  name: string;
  email: string;
  phone?: string;
  roleCode: string;
  roleName: string;
  status: string;
  avatar?: string;
  allowedScreens: string[];
  bookingScope?: 'none' | 'all' | 'assigned';
  bookingCanAssign?: boolean;
  bookingCanReassign?: boolean;
  bookingCanTransition?: boolean;
  bookingCanCancel?: boolean;
  bookingCanReschedule?: boolean;
  dealScope?: 'none' | 'all' | 'assigned';
  dealCanCreate?: boolean;
  dealCanCreateDirect?: boolean;
  dealCanManageContractDeposit?: boolean;
  dealCanManageRentalSchedule?: boolean;
  dealCanManageLifecycle?: boolean;
  authMode: 'postgres';
};

export type AccessTokenPayload = {
  sub: string;
  type: 'access';
  iat?: number;
  exp?: number;
};

export type RequestWithIdentity = {
  headers?: Record<string, string | string[] | undefined>;
  query?: Record<string, unknown>;
  cookies?: Record<string, string | undefined>;
  user?: AppIdentity;
  authMode?: 'postgres';
};
