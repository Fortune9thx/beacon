"""Make beaconlib importable and install the fake GenVM before Beacon.py loads."""

import pathlib
import sys

import pytest

ROOT = pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "contracts"))
sys.path.insert(0, str(ROOT / "tests"))

import fake_genlayer

_GL, _CONTROL, _CHAIN = fake_genlayer.install()

import Beacon as beacon_module


@pytest.fixture
def gl():
    return _GL


@pytest.fixture
def nondet():
    _CONTROL.reset()
    return _CONTROL


@pytest.fixture
def chain():
    _CHAIN.sent.clear()
    return _CHAIN


@pytest.fixture
def beacon():
    return beacon_module
