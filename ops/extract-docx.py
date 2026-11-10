import sys, docx
p = r"C:\Users\<user>\Desktop\外贸社媒工作台 · 需求与准备清单.docx"
d = docx.Document(p)
out = []
for para in d.paragraphs:
    t = para.text.strip()
    if t:
        out.append(f"[{para.style.name}] {t}")
for i, tb in enumerate(d.tables, 1):
    out.append(f"\n=== TABLE {i} ({len(tb.rows)}x{len(tb.columns)}) ===")
    for row in tb.rows:
        out.append(" | ".join(c.text.strip().replace("\n", " ") for c in row.cells))
txt = "\n".join(out)
open(r"E:\破甲工作区\social-workbench\docs\_需求docx.txt", "w", encoding="utf-8").write(txt)
print("chars", len(txt), "paras", len(d.paragraphs), "tables", len(d.tables))