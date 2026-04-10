"""
SVM library — standalone prototype version.

This file is executed by the Pyodide worker and registered as the `svm`
Python module. Students can then do:

    from svm import SVM

Wire format:
    [SVM] ADD_POINT {"x": 1.0, "y": 2.0, "label": 1, "id": 0}
    [SVM] FIT {"C": 1.0}
"""

import json
from enum import Enum


# ── Signal infrastructure ─────────────────────────────────────────────────────

class _SignalType(Enum):
    SVM = "SVM"


class _SVMSignalKey(Enum):
    ADD_POINT = "ADD_POINT"
    FIT = "FIT"


class _SVMSignalMessage:
    """
    Formats and emits a signal on stdout.

    Wire format: [SVM] <KEY> <json_detail>
    Examples:
        [SVM] ADD_POINT {"x": 1.0, "y": 2.0, "label": 1, "id": 0}
        [SVM] FIT {"C": 1.0}
    """

    def __init__(self, key: _SVMSignalKey, detail: dict):
        self.type = _SignalType.SVM
        self.key = key
        self.detail = detail

    def _get_formatted_message(self) -> str:
        msg = f'[{self.type.value}] {self.key.value}'
        if self.detail:
            msg += f' {json.dumps(self.detail)}'
        return msg

    def send(self):
        print(self._get_formatted_message())


# ── Student-facing API ────────────────────────────────────────────────────────

class SVM:
    """
    Student-facing API for the Support Vector Machine mini-app.

    Usage:
        from svm import SVM

        model = SVM(C=1.0)
        model.add_point(1.0, 2.0, label=1)
        model.add_point(-1.0, -2.0, label=-1)
        model.fit()

    After calling fit(), the mini-app trains the SVM and shows the decision
    boundary, margin lines, and support vectors. Use the controls to:
      - Adjust C (regularization) with the slider — smaller C allows more
        margin violations (wider margin), larger C penalizes them (narrower margin)
      - Toggle between Linear and RBF kernels to see how the boundary shape changes

    Parameters:
        C: Regularization parameter. Default: 1.0
    """

    def __init__(self, C: float = 1.0):
        if C <= 0:
            raise ValueError('C must be positive')
        self._C = float(C)
        self._point_id = 0

    def add_point(self, x: float, y: float, label: int):
        """
        Add a labeled 2D data point.

        Args:
            x: x-coordinate
            y: y-coordinate
            label: class label — must be 1 (positive class) or -1 (negative class)
        """
        if label not in (1, -1):
            raise ValueError('label must be 1 or -1')
        _SVMSignalMessage(
            _SVMSignalKey.ADD_POINT,
            {'x': float(x), 'y': float(y), 'label': int(label), 'id': self._point_id},
        ).send()
        self._point_id += 1

    def fit(self):
        """
        Train the SVM on the data added so far.

        Sends the training command to the mini-app, which runs the SVM
        algorithm and displays the decision boundary, margin lines, and
        support vectors interactively.

        Call this after adding all your data points.
        """
        _SVMSignalMessage(
            _SVMSignalKey.FIT,
            {'C': self._C},
        ).send()
