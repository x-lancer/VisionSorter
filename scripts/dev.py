"""
One-command dev runner: start backend + frontend together.

Usage:
  python scripts/dev.py

Requires:
  - Python deps installed (requirements.txt)
  - Node/npm installed
"""

from __future__ import annotations

import os
import shutil
import signal
import subprocess
import sys
from typing import Optional


def _repo_root() -> str:
    return os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))


def _which(cmd: str) -> Optional[str]:
    return shutil.which(cmd)


def _find_python() -> str:
    """Find the best available Python interpreter."""
    # Try python3.11 first (user's preference), then python3, then sys.executable
    for cmd in ("python3.11", "python3", sys.executable):
        if cmd == sys.executable:
            return cmd
        found = _which(cmd)
        if found:
            return found
    # Fallback to sys.executable if nothing found
    return sys.executable


def main() -> int:
    root = _repo_root()

    npm = _which("npm")
    if not npm:
        print("[dev] ERROR: npm not found in PATH. Please install Node.js (includes npm).", file=sys.stderr)
        return 1

    python = _find_python()

    server_cmd = [python, os.path.join(root, "src", "server", "main.py")]
    web_cmd = [npm, "--prefix", os.path.join(root, "src", "web"), "run", "dev"]

    print("[dev] Starting server:", " ".join(server_cmd))
    server_proc = subprocess.Popen(server_cmd, cwd=root)

    print("[dev] Starting web:", " ".join(web_cmd))
    web_proc = subprocess.Popen(web_cmd, cwd=root)

    def _shutdown(*_args: object) -> None:
        for p in (web_proc, server_proc):
            if p.poll() is None:
                try:
                    p.terminate()
                except Exception:
                    pass

    signal.signal(signal.SIGINT, _shutdown)
    try:
        signal.signal(signal.SIGTERM, _shutdown)
    except Exception:
        # Windows may not support SIGTERM the same way
        pass

    # Wait until one exits; if one dies, stop the other too.
    while True:
        sp = server_proc.poll()
        wp = web_proc.poll()
        if sp is not None or wp is not None:
            _shutdown()
            return sp if sp is not None else wp if wp is not None else 0


if __name__ == "__main__":
    raise SystemExit(main())

