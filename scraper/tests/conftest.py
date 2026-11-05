"""I test non toccano mai il database vero, qualunque cosa ci sia in scraper/.env."""
import pytest

from scraper import config


@pytest.fixture(autouse=True)
def bot_on_this_pc(monkeypatch):
    monkeypatch.setattr(config, "BOT_ONLINE", False)
