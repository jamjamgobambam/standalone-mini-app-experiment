"""
Thermostat library — standalone prototype version.

This file is executed by the Pyodide worker and registered as the
`thermostat` Python module. Students can then do:

    from thermostat import run

    def move(current, left, right):
        ...

    run(move)

Wire format:
    [THERMOSTAT] INIT  {"min_temp": 64, "max_temp": 80,
                        "preferences": [...], "start_temp": 65}
    [THERMOSTAT] TURN  {"temp": 66}
    [THERMOSTAT] DONE  {}
"""

import json
from enum import Enum


# ── Signal infrastructure ─────────────────────────────────────────────────────

class _SignalType(Enum):
    THERMOSTAT = "THERMOSTAT"


class _ThermostatSignalKey(Enum):
    INIT = "INIT"
    TURN = "TURN"
    DONE = "DONE"


class _ThermostatSignalMessage:
    """
    Formats and emits a signal on stdout.

    Wire format: [THERMOSTAT] <KEY> <json_detail>
    """

    def __init__(self, key: _ThermostatSignalKey, detail: dict):
        self.type = _SignalType.THERMOSTAT
        self.key = key
        self.detail = detail

    def _get_formatted_message(self) -> str:
        msg = f'[{self.type.value}] {self.key.value}'
        if self.detail is not None:
            msg += f' {json.dumps(self.detail)}'
        return msg

    def send(self):
        print(self._get_formatted_message())


# ── Hardcoded scenario ────────────────────────────────────────────────────────

_MIN_TEMP = 64
_MAX_TEMP = 80

# preferences[i] = number of people who prefer temperature (_MIN_TEMP + i).
# Single-peak distribution centred at 73°F so that hill climbing from a
# colder starting temperature has a clear direction to climb.
_PREFERENCES = [1, 1, 2, 3, 4, 5, 6, 7, 8, 9, 7, 5, 4, 3, 2, 1, 1]

_INITIAL_TEMP = 65

# Cap to prevent infinite loops if a student strategy never settles.
_MAX_ITERATIONS = 200


# ── Helpers ──────────────────────────────────────────────────────────────────

def _people_at(temp):
    """How many people prefer `temp`? 0 if `temp` is outside the dial range."""
    if temp < _MIN_TEMP or temp > _MAX_TEMP:
        return 0
    return _PREFERENCES[temp - _MIN_TEMP]


# ── Student-facing API ────────────────────────────────────────────────────────

def run(move):
    """
    Run hill climbing on the thermostat using the user's `move` strategy.

    For each iteration the library computes:
        current — number of people who prefer the currently set temperature
        left    — number of people who prefer the temperature one degree
                  cooler (0 if the dial is already at the minimum)
        right   — number of people who prefer the temperature one degree
                  warmer (0 if the dial is already at the maximum)

    Then it calls `move(current, left, right)`. The strategy should return
    one of:
        "LEFT"   — turn the dial one degree cooler
        "RIGHT"  — turn the dial one degree warmer
        "STAY"   — leave the dial where it is (ends the optimization)

    The library keeps iterating until the strategy returns "STAY" (or any
    value other than "LEFT"/"RIGHT"), or until 200 iterations have elapsed.
    """
    temp = _INITIAL_TEMP

    # Send the initial scene.
    _ThermostatSignalMessage(
        _ThermostatSignalKey.INIT,
        {
            "min_temp": _MIN_TEMP,
            "max_temp": _MAX_TEMP,
            "preferences": list(_PREFERENCES),
            "start_temp": _INITIAL_TEMP,
        },
    ).send()

    iterations = 0
    while iterations < _MAX_ITERATIONS:
        iterations += 1

        current = _people_at(temp)
        left = _people_at(temp - 1)
        right = _people_at(temp + 1)

        decision = move(current, left, right)

        if decision == "LEFT" and temp > _MIN_TEMP:
            temp -= 1
            _ThermostatSignalMessage(
                _ThermostatSignalKey.TURN,
                {"temp": temp},
            ).send()
        elif decision == "RIGHT" and temp < _MAX_TEMP:
            temp += 1
            _ThermostatSignalMessage(
                _ThermostatSignalKey.TURN,
                {"temp": temp},
            ).send()
        else:
            break

    _ThermostatSignalMessage(_ThermostatSignalKey.DONE, {}).send()
