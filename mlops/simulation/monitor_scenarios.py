"""Build controlled aggregate observations to demonstrate the monitor decisions."""

from core.forecast_features import BUCKETS

SCENARIOS = ("steady", "input_shift", "degraded_close")


def _samples(reference, size=200):
    edges = reference["edges"]
    anchors = ([edges[0] - 1] + edges) if edges else [0]
    values = []
    for anchor, fraction in zip(anchors, reference["proportions"], strict=True):
        values.extend([anchor] * round(fraction * size))
    return values


def observations(model, scenario):
    for bucket in BUCKETS:
        reference = model.references[bucket]
        inputs = {name: _samples(bins) for name, bins in reference.items() if name != "prediction"}
        expected = _samples(reference["prediction"])
        for index, forecast in enumerate(expected):
            features = {name: values[index % len(values)] for name, values in inputs.items()}
            if scenario == "input_shift":
                features["expense_mtd"] = inputs["expense_mtd"][-1] + 100_000
                forecast -= 100_000
            actual = (
                forecast - 2 * model.baseline_mae[bucket] if scenario == "degraded_close" else None
            )
            yield {
                "bucket": bucket,
                "features": features,
                "prediction": forecast,
                "actual": actual,
                "band": model.bands[bucket],
            }
