#!/usr/bin/env python3
"""Compatibility wrapper for terrain generation.

Primary implementation lives in:
- tools/terrain/generate_terrain_map_png.py
"""

from __future__ import annotations

import runpy
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
SCRIPT = ROOT / "tools/terrain/generate_terrain_map_png.py"

runpy.run_path(str(SCRIPT), run_name="__main__")
