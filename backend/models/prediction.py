from sqlalchemy import JSON, BigInteger, Column, Date, DateTime, ForeignKey, Index, Integer, String

from core.orm import Base


class PredictionObservation(Base):
    __tablename__ = "prediction_observations"

    id = Column(Integer, primary_key=True)
    user_id = Column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    cutoff = Column(DateTime(timezone=True), nullable=False)
    period_start = Column(Date, nullable=False)
    period_end = Column(Date, nullable=False)
    model_version = Column(String(32), nullable=False)
    feature_contract = Column(Integer, nullable=False)
    bucket = Column(String(6), nullable=False)
    forecast_cents = Column(BigInteger, nullable=False)
    band_cents = Column(BigInteger, nullable=False)
    features = Column(JSON, nullable=False)
    actual_cents = Column(BigInteger)
    evaluated_at = Column(DateTime(timezone=True))

    __table_args__ = (Index("ix_predictions_period_cutoff", "period_end", "cutoff"),)
