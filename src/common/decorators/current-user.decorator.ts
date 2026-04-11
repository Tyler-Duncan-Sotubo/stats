import { createParamDecorator, ExecutionContext } from '@nestjs/common';

import { User } from '../types/user';

export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): User => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const request = ctx.switchToHttp().getRequest<any>();
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    return request.user as User;
  },
);
