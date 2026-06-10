from pathlib import Path

from config.env import get_bool_env, get_csv_env, get_env

BASE_DIR = Path(__file__).resolve().parent.parent

SECRET_KEY = get_env(
    "DJANGO_SECRET_KEY",
    "non-production-fallback-secret-key-replace-before-use",
)

DEBUG = get_bool_env("DJANGO_DEBUG", default=False)

ALLOWED_HOSTS = get_csv_env("DJANGO_ALLOWED_HOSTS")

CSRF_TRUSTED_ORIGINS = get_csv_env("DJANGO_CSRF_TRUSTED_ORIGINS")

SECURE_SSL_REDIRECT = get_bool_env("DJANGO_SECURE_SSL_REDIRECT", default=False)
SESSION_COOKIE_SECURE = get_bool_env("DJANGO_SESSION_COOKIE_SECURE", default=False)
CSRF_COOKIE_SECURE = get_bool_env("DJANGO_CSRF_COOKIE_SECURE", default=False)

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "apps.common.apps.CommonConfig",
    "apps.inventory.apps.InventoryConfig",
    "apps.reservations.apps.ReservationsConfig",
    "apps.documents.apps.DocumentsConfig",
    "apps.customers.apps.CustomersConfig",
    "rest_framework",
    "drf_spectacular",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": get_env("POSTGRES_DB"),
        "USER": get_env("POSTGRES_USER"),
        "PASSWORD": get_env("POSTGRES_PASSWORD"),
        "HOST": get_env("POSTGRES_HOST", "db"),
        "PORT": get_env("POSTGRES_PORT", "5432"),
    }
}

REDIS_HOST = get_env("REDIS_HOST", "redis")
REDIS_PORT = int(get_env("REDIS_PORT", "6379"))
REDIS_PASSWORD = get_env("REDIS_PASSWORD")

AUTH_PASSWORD_VALIDATORS = [
    {
        "NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator",
    },
    {
        "NAME": "django.contrib.auth.password_validation.MinimumLengthValidator",
    },
    {
        "NAME": "django.contrib.auth.password_validation.CommonPasswordValidator",
    },
    {
        "NAME": "django.contrib.auth.password_validation.NumericPasswordValidator",
    },
]

LANGUAGE_CODE = "en-us"

TIME_ZONE = "UTC"

USE_I18N = True

USE_TZ = True

STATIC_URL = "static/"

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

REST_FRAMEWORK = {
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
}

SPECTACULAR_SETTINGS = {
    "TITLE": "Hahitantsoa Titan ERP API",
    "DESCRIPTION": "Foundation API schema for the Hahitantsoa/Titan ERP project.",
    "VERSION": "0.1.0",
    "SERVE_INCLUDE_SCHEMA": False,
}
