// cookies.decorator.ts
import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const Cookies = createParamDecorator(
  (data: string, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();

    // logger.info('request.cookies', request.cookies);

    return data ? request.cookies?.[data] : request.cookies;
  },
);
