from typing import List
from fastapi import FastAPI
from fastapi.testclient import TestClient
from app.core.config import get_settings


def get_all_route_paths(routes: list, prefix: str = "") -> List[str]:
    """Recursively extract all registered route paths.

    Args:
        routes (list): The list of routing/middleware structures.
        prefix (str): The accumulated URL prefix.

    Returns:
        List[str]: A list of all flattened URL paths.
    """
    paths = []
    for r in routes:
        if type(r).__name__ == "_IncludedRouter":
            p = r.include_context.prefix or ""
            paths.extend(get_all_route_paths(r.original_router.routes, prefix + p))
        elif hasattr(r, "path"):
            paths.append(prefix + r.path)
    return paths


def test_app_startup(app: FastAPI, client: TestClient) -> None:
    """Verify that the FastAPI application starts up correctly with configuration.

    Args:
        app (FastAPI): The test application instance.
        client (TestClient): The test client.
    """
    settings = get_settings()

    # 1. Verify app was created
    assert app is not None

    # 2. Verify app title and version
    assert app.title == settings.app_name
    assert app.version == settings.app_version

    # 3. Verify OpenAPI schema generation
    response = client.get("/openapi.json")
    assert response.status_code == 200
    openapi_data = response.json()
    assert "openapi" in openapi_data
    assert "paths" in openapi_data

    # 4. Verify /api/v1/health route is registered exactly once
    all_paths = get_all_route_paths(app.routes)
    health_path = f"{settings.api_v1_prefix}/health"
    health_route_count = all_paths.count(health_path)

    assert health_route_count == 1
