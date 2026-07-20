"""API utility helpers shared across endpoint modules."""
from fastapi import Request


def get_client_ip(request: Request) -> str:
    """Extract client IP address from an incoming HTTP request safely.

    Uses only request.client.host — does NOT trust X-Forwarded-For headers
    because no verified proxy configuration is in place.

    Args:
        request (Request): Incoming HTTP request.

    Returns:
        str: Client IPv4 or IPv6 address string, or '127.0.0.1' if unavailable.
    """
    return request.client.host if request.client else "127.0.0.1"
