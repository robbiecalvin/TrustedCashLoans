#!/usr/bin/env python3
"""Produce correctly sized PWA PNGs from the existing branded source artwork."""
from pathlib import Path
import sys

from PIL import Image, ImageOps


def main() -> None:
    if len(sys.argv) != 3:
        raise SystemExit("usage: normalize-icons.py SOURCE_PNG OUTPUT_DIRECTORY")

    source = Path(sys.argv[1])
    destination = Path(sys.argv[2])
    destination.mkdir(parents=True, exist_ok=True)

    with Image.open(source) as source_image:
        artwork = source_image.convert("RGBA")
        for size in (180, 192, 512):
            scaled = ImageOps.contain(artwork, (size, size), Image.Resampling.LANCZOS)
            output = Image.new("RGBA", (size, size), (0, 0, 0, 0))
            output.alpha_composite(scaled, ((size - scaled.width) // 2, (size - scaled.height) // 2))
            output.save(destination / f"app-icon-{size}.png", format="PNG", optimize=True)


if __name__ == "__main__":
    main()
