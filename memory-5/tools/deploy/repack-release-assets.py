"""Rebuild a Spring Boot jar unchanged except for explicitly added static assets.

Spring Boot jars contain STORED entries with data descriptors, which the JDK
``jar`` tool refuses to update (``only DEFLATED entries can have EXT descriptor``).
This script rewrites the archive, preserving entry order, compression method and
metadata, and appends the requested resource files under ``BOOT-INF/classes``.

usage: python tools/deploy/repack-release-assets.py <base.jar> <src/main/resources> <output.jar> <rel>...
"""

import sys
import time
import zipfile
from pathlib import Path

base_jar, resource_root, output_jar = (Path(arg) for arg in sys.argv[1:4])
extra = sys.argv[4:]
if not extra:
    raise SystemExit("no extra resources requested")

with zipfile.ZipFile(base_jar) as source:
    entries = [(info, source.read(info.filename)) for info in source.infolist()]

existing = {info.filename for info, _ in entries}
for rel in extra:
    target_name = "BOOT-INF/classes/" + Path(rel).as_posix()
    if target_name in existing:
        raise SystemExit(f"entry already present: {target_name}")

with zipfile.ZipFile(output_jar, "w", allowZip64=True) as target:
    for info, data in entries:
        copy = zipfile.ZipInfo(info.filename, info.date_time)
        copy.compress_type = info.compress_type
        copy.external_attr = info.external_attr
        copy.internal_attr = info.internal_attr
        copy.create_system = info.create_system
        copy.comment = info.comment
        target.writestr(copy, data)

    for rel in extra:
        source_path = resource_root / rel
        stamp = time.localtime(source_path.stat().st_mtime)[:6]
        added = zipfile.ZipInfo("BOOT-INF/classes/" + Path(rel).as_posix(), stamp)
        added.compress_type = zipfile.ZIP_DEFLATED
        added.external_attr = 0o644 << 16
        added.create_system = 3
        target.writestr(added, source_path.read_bytes())

with zipfile.ZipFile(output_jar) as result:
    names = result.namelist()
    broken = result.testzip()
    print(f"entries={len(names)} added={len(extra)} crc_problem={broken}")
    if broken is not None:
        raise SystemExit(f"corrupt entry: {broken}")
