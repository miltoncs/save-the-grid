"""Topology-based terrain map generation primitives."""

from .generator import (
    TerrainConfig,
    TerrainResult,
    TerrainStats,
    generate_terrain,
    save_png,
)

__all__ = [
    "TerrainConfig",
    "TerrainResult",
    "TerrainStats",
    "generate_terrain",
    "save_png",
]
