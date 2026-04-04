from typing import Any


class AppError(Exception):
    """Base application error."""

    def __init__(self, message: str, status_code: int = 500, detail: Any = None) -> None:
        self.message = message
        self.status_code = status_code
        self.detail = detail
        super().__init__(message)


class NotFoundError(AppError):
    def __init__(self, resource: str, resource_id: Any = None) -> None:
        msg = f"{resource} not found"
        if resource_id is not None:
            msg = f"{resource} with id '{resource_id}' not found"
        super().__init__(message=msg, status_code=404)


class ValidationError(AppError):
    def __init__(self, message: str, detail: Any = None) -> None:
        super().__init__(message=message, status_code=422, detail=detail)


class ExternalServiceError(AppError):
    def __init__(self, service: str, message: str) -> None:
        super().__init__(message=f"{service} error: {message}", status_code=502)


class FileTooLargeError(AppError):
    def __init__(self, max_size_mb: int) -> None:
        super().__init__(
            message=f"File exceeds maximum size of {max_size_mb}MB",
            status_code=413,
        )


class UnsupportedFileTypeError(AppError):
    def __init__(self, file_type: str) -> None:
        super().__init__(
            message=f"Unsupported file type: {file_type}",
            status_code=415,
        )
