import { SetMetadata } from '@nestjs/common';

export const AUTH_ACCESS_KEY = 'tinyhouse:auth-access';
export const AUTH_ROLES_KEY = 'tinyhouse:auth-roles';
export const CMS_SCREEN_KEY = 'tinyhouse:cms-screen';

export type AuthAccessMode = 'public' | 'public-read' | 'authenticated' | 'optional-auth';

export const OptionalAuth = () => SetMetadata(AUTH_ACCESS_KEY, 'optional-auth');

export const Public = () => SetMetadata(AUTH_ACCESS_KEY, 'public');
export const PublicRead = () => SetMetadata(AUTH_ACCESS_KEY, 'public-read');
export const Authenticated = () => SetMetadata(AUTH_ACCESS_KEY, 'authenticated');
export const Roles = (...roles: string[]) => SetMetadata(AUTH_ROLES_KEY, roles);
export const CmsScreen = (screen: string) => SetMetadata(CMS_SCREEN_KEY, screen);
