from pathlib import Path
import re
p = Path("index.html")
if not p.exists():
    raise SystemExit("لم أجد index.html. ضع هذا الملف بجوار index.html داخل مجلد المشروع.")
s = p.read_text(encoding="utf-8")
block = '''<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
<script src="./supabase-config.js"></script>
<script src="./cloud/supabase-sync.js"></script>'''
count = s.count(block)
if count != 4:
    raise SystemExit(f"توقفت للحماية: توقعت 4 مجموعات استدعاء، ووجدت {count}. لم يتم تعديل الملف.")
# Keep the final, page-level Supabase loader only. Remove the three copies embedded
# in document.write() print templates.
parts = s.split(block)
s = parts[0] + parts[1] + parts[2] + parts[3] + block + parts[4]
# Ensure the main inline script parses as JavaScript after the repair.
scripts = re.findall(r"<script(?:\s[^>]*)?>([\s\S]*?)</script>", s, flags=re.I)
inline = [x.strip() for x in scripts if x.strip()]
try:
    import subprocess, tempfile
    with tempfile.NamedTemporaryFile("w", suffix=".js", encoding="utf-8", delete=False) as f:
        f.write("\n".join(inline))
        tmp = f.name
    result = subprocess.run(["node", "--check", tmp], capture_output=True, text=True)
    Path(tmp).unlink(missing_ok=True)
    if result.returncode:
        raise SystemExit("فشل فحص JavaScript ولم يتم حفظ التعديل:\n" + result.stderr)
except FileNotFoundError:
    print("تنبيه: Node.js غير مثبت؛ تم تطبيق الإصلاح دون فحص node --check.")
p.write_text(s, encoding="utf-8")
print("تم إصلاح index.html بنجاح. ارفع الملف المعدل إلى GitHub واستبدل الملف القديم.")
