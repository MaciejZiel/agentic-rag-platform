"""Middleware that injects standard rate-limit headers into every response.

Headers added:
  X-RateLimit-Limit     – max requests allowed in window
  X-RateLimit-Remaining – requests remaining in window
  X-RateLimit-Reset     – UTC epoch when the window resets
"""

import time

from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import Response


# Default rate-limit values (matching slowapi configuration)
DEFAULT_LIMIT = 100
WINDOW_SECONDS = 60


class RateLimitHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(
        self, request: Request, call_next: RequestResponseEndpoint,
    ) -> Response:
        response = await call_next(request)

        # slowapi stores rate-limit state in the request scope
        rate_limit_info = getattr(request.state, "_rate_limit", None)

        if rate_limit_info and hasattr(rate_limit_info, "limit"):
            response.headers["X-RateLimit-Limit"] = str(rate_limit_info.limit)
            response.headers["X-RateLimit-Remaining"] = str(
                max(0, rate_limit_info.limit - rate_limit_info.current)
            )
            response.headers["X-RateLimit-Reset"] = str(
                int(rate_limit_info.reset_at.timestamp())
                if hasattr(rate_limit_info, "reset_at")
                else int(time.time()) + WINDOW_SECONDS
            )
        else:
            # Provide sensible defaults even when slowapi state isn't available
            response.headers["X-RateLimit-Limit"] = str(DEFAULT_LIMIT)
            response.headers["X-RateLimit-Reset"] = str(
                int(time.time()) + WINDOW_SECONDS
            )

        return response
