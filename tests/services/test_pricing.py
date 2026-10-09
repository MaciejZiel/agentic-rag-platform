import tomllib
from pathlib import Path

import pytest

from app.api.v1.models import AVAILABLE_MODELS
from app.core.config import settings
from app.core.pricing import DEFAULT_PRICING_FILE, ModelPrice, estimate_cost, load_pricing


def _raw_table() -> dict:
    with DEFAULT_PRICING_FILE.open("rb") as f:
        return tomllib.load(f)


def test_every_selectable_model_has_a_pricing_entry():
    """Each model is either priced or explicitly marked as having no verified price."""
    table = load_pricing(DEFAULT_PRICING_FILE)
    models = {m["id"] for m in AVAILABLE_MODELS} | {settings.chat_model, settings.embedding_model}
    assert models <= table.keys()


def test_every_price_cites_an_official_source():
    for model, entry in _raw_table().items():
        if "input" in entry:
            assert entry.get("source", "").startswith("https://"), model


def test_known_model_cost():
    assert estimate_cost("openai/gpt-4o-mini", 1_000, 500) == pytest.approx(
        (1_000 * 0.15 + 500 * 0.60) / 1_000_000
    )


def test_long_context_tier_applies_above_threshold():
    short = estimate_cost("google/gemini-2.5-pro", 200_000, 1_000)
    long = estimate_cost("google/gemini-2.5-pro", 200_001, 1_000)
    assert short == pytest.approx((200_000 * 1.25 + 1_000 * 10) / 1_000_000)
    assert long == pytest.approx((200_001 * 2.50 + 1_000 * 15) / 1_000_000)


@pytest.mark.parametrize("model", ["meta-llama/llama-4-maverick", "vendor/not-in-the-table"])
def test_unpriced_or_unknown_models_have_no_cost(model: str):
    assert estimate_cost(model, 1_000, 1_000) is None


def test_custom_pricing_file(tmp_path: Path):
    path = tmp_path / "prices.toml"
    path.write_text('["x/model"]\ninput = 1\noutput = 2\n\n["y/model"]\nnote = "unknown"\n')
    table = load_pricing(path)
    assert table["x/model"] == ModelPrice(input=1.0, output=2.0)
    assert table["y/model"] is None
