#!/usr/bin/env python3
"""One build for every page. Sources: index.html (the long page, with placeholders), space/index.src.html
(the Space page), space/record.html (the video compositor), fluid.js, fire.js, fire.s, evals/cases.json,
space/words.json. Outputs: space/index.html, space/about.html, space/cases.json, space/FIRE.COM."""
import pathlib, subprocess, shutil, html, re
root = pathlib.Path(__file__).parent
fl = (root / "fluid.js").read_text(); js = (root / "fire.js").read_text()
sp = root / "space"
# the assembler
subprocess.run(["as", "--32", str(root / "fire.s"), "-o", "/tmp/fire.o"], check=True)
subprocess.run(["ld", "-m", "elf_i386", "-Ttext=0x100", "--oformat", "binary", "/tmp/fire.o", "-o", str(sp / "FIRE.COM")], check=True)
n = len((sp / "FIRE.COM").read_bytes())
# the Space page
s = (sp / "index.src.html").read_text()
asm = html.escape((root / "fire.s").read_text().rstrip())
s = re.sub(r"(<details><summary>the whole program, fire\.s</summary>.*?<pre>).*?(</pre></details>)", lambda m: m.group(1) + asm + m.group(2), s, flags=re.S)
s = re.sub(r"\b1[45][35] bytes", f"{n} bytes", s)
(sp / "index.html").write_text(s.replace("__FLUID_JS__", fl))
# the long page
full = (root / "index.html").read_text().replace("__FLUID_JS__", fl).replace("__FIRE_JS__", js)
about = full.replace('<span class="eyebrow">A campfire, from the equations up. The embers are your words.</span>',
                     '<span class="eyebrow"><a href="index.html" style="text-decoration:none">← the simple version</a> · <a href="eval.html" style="text-decoration:none">evals</a> · A campfire, from the equations up.</span>', 1)
(sp / "about.html").write_text(about)
# data the Space serves
shutil.copy(root / "evals" / "cases.json", sp / "cases.json")
print(f"built: FIRE.COM {n} bytes, space/index.html, space/about.html, space/cases.json")
