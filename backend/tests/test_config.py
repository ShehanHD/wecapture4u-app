from config import settings


def test_settings_loads():
    assert settings.JWT_ALGORITHM == "HS256"
    assert settings.ACCESS_TOKEN_EXPIRE_MINUTES == 15
    assert settings.ADMIN_REFRESH_TOKEN_EXPIRE_HOURS == 8
    assert settings.CLIENT_REFRESH_TOKEN_EXPIRE_HOURS == 24


def test_allowed_origins_list_includes_localhost_in_dev(monkeypatch):
    monkeypatch.setattr(settings, "ENVIRONMENT", "development")
    monkeypatch.setattr(settings, "ALLOWED_ORIGINS", "https://example.com")
    assert "http://localhost:5173" in settings.allowed_origins_list


def test_allowed_origins_list_no_localhost_in_prod(monkeypatch):
    monkeypatch.setattr(settings, "ENVIRONMENT", "production")
    monkeypatch.setattr(settings, "ALLOWED_ORIGINS", "https://example.com")
    assert "http://localhost:5173" not in settings.allowed_origins_list
