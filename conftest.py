import sys
from pathlib import Path

root = Path(__file__).resolve().parent
backend = root / "backend"
for p in (str(root), str(backend)):
    if p not in sys.path:
        sys.path.insert(0, p)
