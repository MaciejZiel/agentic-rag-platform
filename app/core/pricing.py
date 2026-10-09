"""Data-driven model pricing and cost estimation.

Prices live in ``app/config/model_pricing.toml`` (or the file named by the
``MODEL_PRICING_FILE`` setting). A model that is missing from the table, or
listed without a price, has an unknown cost: ``estimate_cost`` returns
``None`` rather than a made-up number.
"""

import tomllib
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger(__name__)

DEFAULT_PRICING_FILE = Path(__file__).resolve().parent.parent / "config" / "model_pricing.toml"


@dataclass(frozen=True)
class ModelPrice:
    input: float  # USD per 1M prompt tokens
    output: float  # USD per 1M completion tokens
    long_context_threshold: int | None = None
    long_input: float | None = None
    long_output: float | None = None

    def cost(self, prompt_tokens: int, completion_tokens: int) -> float:
        input_rate, output_rate = self.input, self.output
        if self.long_context_threshold is not None and prompt_tokens > self.long_context_threshold:
            input_rate = self.long_input if self.long_input is not None else input_rate
            output_rate = self.long_output if self.long_output is not None else output_rate
        return (prompt_tokens * input_rate + completion_tokens * output_rate) / 1_000_000


def load_pricing(path: Path) -> dict[str, ModelPrice | None]:
    """Parse a pricing file. Entries without input/output prices map to None."""
    with path.open("rb") as f:
        raw = tomllib.load(f)
    table: dict[str, ModelPrice | None] = {}
    for model, entry in raw.items():
        if "input" in entry and "output" in entry:
            table[model] = ModelPrice(
                input=float(entry["input"]),
                output=float(entry["output"]),
                long_context_threshold=entry.get("long_context_threshold"),
                long_input=entry.get("long_input"),
                long_output=entry.get("long_output"),
            )
        else:
            table[model] = None
    return table


@lru_cache(maxsize=1)
def get_pricing() -> dict[str, ModelPrice | None]:
    return load_pricing(settings.model_pricing_file or DEFAULT_PRICING_FILE)


def estimate_cost(model: str, prompt_tokens: int, completion_tokens: int) -> float | None:
    """USD cost of a call, or None when the model has no verified price."""
    price = get_pricing().get(model)
    if price is None:
        logger.info("model_cost_unknown", model=model)
        return None
    return price.cost(prompt_tokens, completion_tokens)
