"""Finishes a printed collateral PDF: sets the document properties and writes a lighter copy for email.

    py collateral/tools/finish.py <print.pdf> <email.pdf> --title "Infraglance — Company profile" [--dpi 200]

The print copy keeps full-resolution images (for professional print). The email copy downsamples every image
above (dpi + 40) ppi of its placed size to <dpi> ppi, re-encoded as JPEG q82, which brings 20–30 MB down to
about 6–10 MB. Needs PyMuPDF (pip install pymupdf). Run with PYTHONIOENCODING=utf-8 on Windows.
"""
import argparse
import os

import pymupdf

ap = argparse.ArgumentParser()
ap.add_argument("print_pdf")
ap.add_argument("email_pdf")
ap.add_argument("--title", required=True)
ap.add_argument("--subject", default="Vision AI for industry and infrastructure")
ap.add_argument("--dpi", type=int, default=200)
ap.add_argument("--toc", help="JSON from pdf.mjs --toc: [{page, title}], one bookmark per page")
a = ap.parse_args()
TOC = []
if a.toc:
    import json

    with open(a.toc, encoding="utf-8") as f:
        TOC = [[1, e["title"], e["page"]] for e in json.load(f)]

META = {
    "title": a.title,
    "author": "Infraglance",
    "subject": a.subject,
    "keywords": "Infraglance, vision AI, computer vision, industrial safety, quality inspection, infrastructure",
    "creator": "Infraglance",
    "producer": "Infraglance",
}


def mb(p):
    return f"{os.path.getsize(p) / 1e6:.1f} MB"


def snap_page_size(doc):
    """Trims each page to a multiple of 3 pt, keeping the top-left corner where it is.
    Edge's PDF engine (Adobe) renders pages in tiles. When a page is not a whole number of screen pixels
    (Chrome prints A4 as 594.96 x 841.92 pt = 793.3 x 1122.6 px at 100%), the tiles leave 1 px seams that show
    as thin light lines across coloured backgrounds and photos. A multiple of 3 pt is a whole number of pixels
    at 100%, 125% and 150% display scaling (pt x 4/3, x 5/3, x 2). A4 becomes 594 x 840 pt (trims under 1 mm);
    the 16:9 decks (960 x 540 pt) are already fine and stay as they are."""
    for page in doc:
        box = doc.xref_get_key(page.xref, "MediaBox")
        if box[0] != "array":
            continue
        x0, y0, x1, y1 = (float(v) for v in box[1].strip("[]").split())
        w, h = (x1 - x0) // 3 * 3, (y1 - y0) // 3 * 3
        if abs((x1 - x0) - w) < 0.005 and abs((y1 - y0) - h) < 0.005:
            continue
        doc.xref_set_key(page.xref, "MediaBox", f"[{x0:g} {y1 - h:.4f} {x0 + w:g} {y1:g}]")
        if doc.xref_get_key(page.xref, "CropBox")[0] != "null":
            doc.xref_set_key(page.xref, "CropBox", "null")


def finish(doc):
    snap_page_size(doc)
    doc.set_metadata({**doc.metadata, **META})
    if TOC:
        doc.set_toc(TOC)
    # Open on the page itself (bookmarks stay one click away) with the document title in the window bar.
    doc.xref_set_key(doc.pdf_catalog(), "PageMode", "/UseNone")  # bookmarks available, panel closed
    doc.xref_set_key(doc.pdf_catalog(), "ViewerPreferences", "<</DisplayDocTitle true>>")


# Print copy: metadata only, saved in place (incremental save keeps the images untouched).
doc = pymupdf.open(a.print_pdf)
finish(doc)
doc.saveIncr()
doc.close()

def downsample(doc, dpi):
    """Resizes every image to what its largest placement needs at `dpi` (x1.25 for photos, x2 for lossless
    screenshots so UI text stays crisp) and re-encodes it as JPEG q82, soft masks as 8-bit Flate.
    Works on the image streams only. Document.rewrite_images() rewrites page content and drops Chrome's
    Pattern resources (missing fills on most pages), so it is not used."""
    page_cap = round(max(doc[0].rect.width, doc[0].rect.height) / 72 * dpi)
    need = {}
    for pg in doc:
        for info in pg.get_image_info(xrefs=True):
            r = pymupdf.Rect(info["bbox"])
            need[info["xref"]] = max(need.get(info["xref"], 0), round(max(r.width, r.height) / 72 * dpi))
    smasks = set()
    for x in range(1, doc.xref_length()):
        k = doc.xref_get_key(x, "SMask")
        if k[0] == "xref":
            smasks.add(int(k[1].split()[0]))
    done = 0
    for x in range(1, doc.xref_length()):
        if x in smasks or doc.xref_get_key(x, "Subtype")[1] != "/Image":
            continue
        w, h = int(doc.xref_get_key(x, "Width")[1]), int(doc.xref_get_key(x, "Height")[1])
        lossless = doc.xref_get_key(x, "Filter")[1] != "/DCTDecode"
        cap = min(page_cap, max(800, round(need[x] * (2 if lossless else 1.25)))) if x in need else page_cap
        if max(w, h) <= cap and not (lossless and len(doc.xref_stream_raw(x)) > 300_000):
            continue
        cap = min(cap, max(w, h))
        f = cap / max(w, h)
        nw, nh = max(1, round(w * f)), max(1, round(h * f))
        pix = pymupdf.Pixmap(doc, x)
        if pix.alpha:
            pix = pymupdf.Pixmap(pix, 0)
        if pix.n not in (1, 3):
            pix = pymupdf.Pixmap(pymupdf.csRGB, pix)
        small = pymupdf.Pixmap(pix, nw, nh, None)
        doc.update_stream(x, small.tobytes("jpeg", jpg_quality=82), compress=False)
        for key, val in (("Filter", "/DCTDecode"), ("DecodeParms", "null"), ("Width", str(nw)), ("Height", str(nh)),
                         ("BitsPerComponent", "8"), ("ColorSpace", "/DeviceGray" if small.n == 1 else "/DeviceRGB")):
            doc.xref_set_key(x, key, val)
        k = doc.xref_get_key(x, "SMask")
        if k[0] == "xref":
            m = int(k[1].split()[0])
            mpix = pymupdf.Pixmap(doc, m)
            if mpix.n != 1 or mpix.alpha:
                mpix = pymupdf.Pixmap(pymupdf.csGRAY, mpix)
            msmall = pymupdf.Pixmap(mpix, nw, nh, None)
            doc.update_stream(m, msmall.samples, compress=True)
            for key, val in (("DecodeParms", "null"), ("Width", str(nw)), ("Height", str(nh)),
                             ("BitsPerComponent", "8"), ("ColorSpace", "/DeviceGray")):
                doc.xref_set_key(m, key, val)
        done += 1
    return done


# Email copy: downsample and re-encode the images, then clean and compress.
doc = pymupdf.open(a.print_pdf)
n = downsample(doc, a.dpi)
finish(doc)
doc.ez_save(a.email_pdf, garbage=4, deflate=True)
print(f"{n} images resized for {a.dpi} ppi")
doc.close()
print(f"print → {a.print_pdf} ({mb(a.print_pdf)})\nemail → {a.email_pdf} ({mb(a.email_pdf)})")
