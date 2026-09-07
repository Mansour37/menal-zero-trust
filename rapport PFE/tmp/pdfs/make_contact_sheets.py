from pathlib import Path
from PIL import Image, ImageDraw, ImageFont


def make_sheets(source: Path, target: Path, prefix: str) -> None:
    files = sorted(source.glob("page-*.png"), key=lambda p: int(p.stem.split("-")[-1]))
    target.mkdir(parents=True, exist_ok=True)
    cell_w, cell_h = 420, 594
    cols, rows = 3, 3
    margin, label_h = 14, 26
    font = ImageFont.load_default(size=18)

    for start in range(0, len(files), cols * rows):
        batch = files[start : start + cols * rows]
        canvas = Image.new(
            "RGB",
            (cols * cell_w + (cols + 1) * margin, rows * (cell_h + label_h) + (rows + 1) * margin),
            "#d7d7d7",
        )
        draw = ImageDraw.Draw(canvas)
        for offset, path in enumerate(batch):
            row, col = divmod(offset, cols)
            x = margin + col * (cell_w + margin)
            y = margin + row * (cell_h + label_h + margin)
            with Image.open(path) as page:
                thumb = page.convert("RGB")
                thumb.thumbnail((cell_w, cell_h), Image.Resampling.LANCZOS)
                px = x + (cell_w - thumb.width) // 2
                py = y + label_h + (cell_h - thumb.height) // 2
                canvas.paste(thumb, (px, py))
                draw.rectangle((px, py, px + thumb.width - 1, py + thumb.height - 1), outline="#444444", width=1)
            page_no = int(path.stem.split("-")[-1])
            draw.text((x + 4, y + 2), f"Page physique {page_no}", fill="black", font=font)
        sheet_no = start // (cols * rows) + 1
        canvas.save(target / f"{prefix}_{sheet_no:02d}.jpg", quality=88, optimize=True)


root = Path(__file__).resolve().parent
make_sheets(root / "final_qa_107", root / "contact_final", "final")
make_sheets(root / "draft_qa_115", root / "contact_draft", "draft")
make_sheets(root / "final_qa_112", root / "contact_final_latest", "final_latest")
make_sheets(root / "draft_qa_116", root / "contact_draft_latest", "draft_latest")
