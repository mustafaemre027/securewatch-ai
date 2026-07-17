from pydantic import BaseModel


class HealthResponse(BaseModel):
    """Schema representing the application health status.

    Attributes:
        status (str): The overall status of the service.
        service (str): The name of the application.
        version (str): The current version of the application.
        database (str): The status of the database connection.
    """
    status: str
    service: str
    version: str
    database: str
