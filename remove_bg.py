"""Remove the background from the portrait and save a transparent PNG.

Put this file next to 1000440301.jpg and run:
    python remove_bg.py
Or choose the files yourself:
    python remove_bg.py my-photo.jpg portrait-cutout.png

It installs what it needs (rembg) on the first run. The first run also downloads
a small AI model (about 170 MB), so it needs an internet connection once.
The output keeps the same width and height as the input, so the framing in
style.css stays the same.
"""
import subprocess
import sys

SRC = sys.argv[1] if len(sys.argv) > 1 else "1000440301.jpg"
DST = sys.argv[2] if len(sys.argv) > 2 else "portrait-cutout.png"

try:
    from rembg import new_session, remove
except ImportError:
    subprocess.check_call([sys.executable, "-m", "pip", "install", "rembg[cpu]", "pillow"])
    from rembg import new_session, remove

from PIL import Image

img = Image.open(SRC).convert("RGB")

# The human-segmentation model is tuned for people; alpha matting softens hair edges.
session = new_session("u2net_human_seg")
cut = remove(
    img,
    session=session,
    alpha_matting=True,
    alpha_matting_foreground_threshold=240,
    alpha_matting_background_threshold=15,
    alpha_matting_erode_size=8,
)

cut.save(DST, optimize=True)
print(f"Saved {DST} ({cut.width}x{cut.height}, transparent background)")
