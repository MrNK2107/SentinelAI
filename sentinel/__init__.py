"""Sentinel package alias pointing to backend."""
from pathlib import Path
import sys

_backend = Path(__file__).resolve().parent.parent / "backend"
if str(_backend) not in sys.path:
    sys.path.insert(0, str(_backend))

# Allow sentinel.* imports to find files in backend/*
__path__ = [str(_backend)]

from backend import *  # noqa: F401, F403
from backend import __version__  # noqa: F401
