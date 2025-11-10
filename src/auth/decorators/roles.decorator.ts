import { SetMetadata } from '@nestjs/common';
import { UserRole } from '@prisma/client';

// Set roles to restrict routes to specific user roles
export const ROLES_KEY = 'roles';
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
