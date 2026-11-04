"""Additive, language-neutral transport codes; retain existing safe API diagnostics."""

from fastapi import FastAPI, Request
from fastapi.exception_handlers import http_exception_handler, request_validation_exception_handler
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException


def install_error_codes(app: FastAPI) -> None:
    @app.exception_handler(HTTPException)
    async def http_error(request: Request, exc: HTTPException):
        response = await http_exception_handler(request, exc)
        response.headers["X-Error-Code"] = f"HTTP_{exc.status_code}"
        return response

    @app.exception_handler(RequestValidationError)
    async def validation_error(request: Request, exc: RequestValidationError):
        response = await request_validation_exception_handler(request, exc)
        response.headers["X-Error-Code"] = "VALIDATION_ERROR"
        return response
