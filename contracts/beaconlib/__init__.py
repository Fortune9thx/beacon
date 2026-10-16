"""beaconlib -- the dependency-free logic behind the BEACON contract.

Nothing in this package imports `genlayer`. Every rule that decides a status --
SSRF policy, canonicalization and the policy hash, and the normalization of a
model's answer -- lives here so it can be unit-tested under CPython and audited
without the VM. `contracts/build_bundle.py` inlines these modules into the
single deployable file.
"""
