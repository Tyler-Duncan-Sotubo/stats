import { createParamDecorator, ExecutionContext } from '@nestjs/common';

import { User } from '../types/user';

export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): User => {
    const request = ctx.switchToHttp().getRequest<any>();
    return request.user as User;
  },
);
