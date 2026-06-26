import pytest
from django.core.management import call_command

from apps.common.management.commands.seed_all_demo import SEED_ORDER

pytestmark = pytest.mark.django_db


def test_seed_all_demo_refuses_when_debug_false(settings, capsys) -> None:
    settings.DEBUG = False

    call_command("seed_all_demo")

    captured = capsys.readouterr().out
    assert "Refusing to seed demo data when DEBUG is False." in captured


def test_seed_all_demo_runs_all_seeds_when_debug_true(settings, capsys) -> None:
    settings.DEBUG = True

    call_command("seed_all_demo")

    captured = capsys.readouterr().out
    for seed_command in SEED_ORDER:
        assert f"Running {seed_command}" in captured
        assert f"{seed_command} done." in captured

    assert f"All {len(SEED_ORDER)} demo seed commands completed successfully." in captured


def test_seed_all_demo_is_idempotent(settings, capsys) -> None:
    settings.DEBUG = True

    call_command("seed_all_demo")
    first_output = capsys.readouterr().out

    call_command("seed_all_demo")
    second_output = capsys.readouterr().out

    assert f"All {len(SEED_ORDER)} demo seed commands completed successfully." in first_output
    assert f"All {len(SEED_ORDER)} demo seed commands completed successfully." in second_output
