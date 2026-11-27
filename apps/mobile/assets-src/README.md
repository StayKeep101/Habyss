# Source art (never shipped)

Full-quality originals the app's artwork is made from. Metro only bundles files the code requires, so nothing here
reaches the app or an update.

The app ships WebP made from these (about a fifth of the size, visually identical, 40 dB+ PSNR):

```sh
cwebp -q 92 -alpha_q 100 -m 6 -sharp_yuv assets-src/hourglasses/frames/master.png -o assets/images/hourglasses/frames/master.webp
```

`scripts/extract-hourglass-sand.py` and `scripts/trace-hourglass-frames.py` read and write the PNGs here; convert what
they change with the command above.
