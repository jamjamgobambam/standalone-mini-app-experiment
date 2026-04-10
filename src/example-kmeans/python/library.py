"""
K-Means library — standalone prototype version.

This file is executed by the Pyodide worker and registered as the `kmeans`
Python module. Students can then do:

    from kmeans import KMeans

This is the self-contained equivalent of the production Python package at
python/pythonlab/kmeans/. When promoting to production, split this into:

    python/pythonlab/kmeans/
      pyproject.toml
      kmeans/
        __init__.py
        kmeans.py                  ← the KMeans class below
        support/
          __init__.py
          kmeans_signal_key.py     ← KMeansSignalKey enum
          kmeans_signal_message.py ← KMeansSignalMessage class
          signal_message_type.py   ← SignalMessageType enum

Then build the wheel and follow the production checklist.
"""

import json
from enum import Enum


# ── Signal infrastructure (becomes the support/ package) ─────────────────

class _SignalType(Enum):
    KMEANS = "KMEANS"


class _KMeansSignalKey(Enum):
    ADD_POINT = "ADD_POINT"
    READY = "READY"


class _KMeansSignalMessage:
    """
    Formats and emits a signal on stdout.

    Wire format: [KMEANS] <KEY> <json_detail>
    Examples:
        [KMEANS] ADD_POINT {"x": 1.0, "y": 2.0, "id": 0}
        [KMEANS] READY {"k": 3}
    """

    def __init__(self, key: _KMeansSignalKey, detail: dict):
        self.type = _SignalType.KMEANS
        self.key = key
        self.detail = detail

    def _get_formatted_message(self) -> str:
        msg = f'[{self.type.value}] {self.key.value}'
        if self.detail:
            msg += f' {json.dumps(self.detail)}'
        return msg

    def send(self):
        print(self._get_formatted_message())


# ── Student-facing API ────────────────────────────────────────────────────

class KMeans:
    """
    Student-facing API for the K-Means Clustering mini-app.

    Usage:
        from kmeans import KMeans

        model = KMeans(k=3)
        model.add_point(1.0, 2.0)
        model.add_point(4.5, 1.5)
        model.add_point(8.0, 7.0)
        model.init()

    After calling init(), control passes to the interactive buttons in the
    mini-app panel. Use "Initialize Centroids", "Step", and "Play" to explore
    the algorithm.
    """

    def __init__(self, k: int):
        if k < 1:
            raise ValueError('k must be at least 1')
        self._k = k
        self._point_id = 0

    def add_point(self, x: float, y: float):
        """Add a data point to the visualization."""
        _KMeansSignalMessage(
            _KMeansSignalKey.ADD_POINT,
            {'x': float(x), 'y': float(y), 'id': self._point_id},
        ).send()
        self._point_id += 1

    def init(self):
        """
        Send all data to the mini-app and unlock the interactive controls.
        Call this after adding all points.
        """
        _KMeansSignalMessage(
            _KMeansSignalKey.READY,
            {'k': self._k},
        ).send()
