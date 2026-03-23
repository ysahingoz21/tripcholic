from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    PORT: int = 8000
    ENV: str = "development"
    APP_NAME: str = "Tripcholic Optimizer"
    APP_VERSION: str = "0.1.0"
    LOG_LEVEL: str = "INFO"
    OSRM_BASE_URL: str = "http://router.project-osrm.org"
    POI_DATA_PATH: str = "../../data/istanbul_poi_dataset.csv"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
    )


settings = Settings()
