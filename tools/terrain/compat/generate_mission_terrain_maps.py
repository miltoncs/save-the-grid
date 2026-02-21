#!/usr/bin/env python3
"""Compatibility wrapper for mission terrain generation.

Primary implementation lives in:
- tools/terrain/generate_mission_terrain_maps.py
"""

from __future__ import annotations

import runpy
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
SCRIPT = ROOT / "tools/terrain/generate_mission_terrain_maps.py"

runpy.run_path(str(SCRIPT), run_name="__main__")
