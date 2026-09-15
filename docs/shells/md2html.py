#!/usr/bin/env python3
"""Small stdlib markdown -> self-contained HTML converter (no external deps).
Handles: headings, paragraphs, bold/italic/code spans, links (unused here),
unordered lists, GFM-style pipe tables, hr, blockquote-style italic lead line.
Good enough for one specific document; not a general markdown engine.
"""
import re
import sys
import html


def inline(text):
    text = html.escape(text, quote=False)
    # bold+italic combos first
    text = re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", text)
    text = re.sub(r"(?<!\*)\*([^*]+?)\*(?!\*)", r"<em>\1</em>", text)
    text = re.sub(r"`([^`]+?)`", r"<code>\1</code>", text)
    return text


def parse_table(lines, i):
    header = [c.strip() for c in lines[i].strip().strip('|').split('|')]
    i += 2  # skip separator row
    rows = []
    while i < len(lines) and lines[i].strip().startswith('|'):
        rows.append([c.strip() for c in lines[i].strip().strip('|').split('|')])
        i += 1
    out = ['<table>', '<thead><tr>']
    for h in header:
        out.append(f'<th>{inline(h)}</th>')
    out.append('</tr></thead><tbody>')
    for r in rows:
        out.append('<tr>')
        for c in r:
            out.append(f'<td>{inline(c)}</td>')
        out.append('</tr>')
    out.append('</tbody></table>')
    return '\n'.join(out), i


def convert(md_text):
    lines = md_text.split('\n')
    out = []
    i = 0
    in_list = False
    n = len(lines)
    while i < n:
        line = lines[i]
        stripped = line.strip()

        if not stripped:
            if in_list:
                out.append('</ul>')
                in_list = False
            i += 1
            continue

        if stripped == '---':
            out.append('<hr>')
            i += 1
            continue

        m = re.match(r'^(#{1,6})\s+(.*)$', stripped)
        if m:
            if in_list:
                out.append('</ul>')
                in_list = False
            level = len(m.group(1))
            out.append(f'<h{level}>{inline(m.group(2))}</h{level}>')
            i += 1
            continue

        if stripped.startswith('|') and i + 1 < n and re.match(r'^\|?\s*-+', lines[i + 1].strip()):
            if in_list:
                out.append('</ul>')
                in_list = False
            table_html, i = parse_table(lines, i)
            out.append(table_html)
            continue

        if stripped.startswith('- '):
            if not in_list:
                out.append('<ul>')
                in_list = True
            out.append(f'<li>{inline(stripped[2:])}</li>')
            i += 1
            continue

        if in_list:
            out.append('</ul>')
            in_list = False

        # italic-only line (whole line wrapped in single asterisks) -> lead paragraph style
        if stripped.startswith('*') and stripped.endswith('*') and not stripped.startswith('**'):
            out.append(f'<p class="lead">{inline(stripped)}</p>')
            i += 1
            continue

        # plain paragraph: gather until blank line
        para_lines = [stripped]
        i += 1
        while i < n and lines[i].strip() and not lines[i].strip().startswith(('#', '- ', '|', '---')):
            para_lines.append(lines[i].strip())
            i += 1
        out.append(f'<p>{inline(" ".join(para_lines))}</p>')

    if in_list:
        out.append('</ul>')

    return '\n'.join(out)


TEMPLATE = """<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>{title}</title>
<style>
  :root {{
    color-scheme: light;
    --ink: #1c2024;
    --muted: #5a6270;
    --border: #d7dbe0;
    --accent: #2f5fae;
    --bg-table-head: #eef1f5;
    --bg-code: #f2f3f5;
  }}
  * {{ box-sizing: border-box; }}
  body {{
    margin: 0;
    background: #ffffff;
    color: var(--ink);
    font-family: Georgia, 'Times New Roman', serif;
    line-height: 1.55;
    font-size: 15px;
  }}
  .page {{
    max-width: 850px;
    margin: 0 auto;
    padding: 48px 56px 72px;
  }}
  h1 {{
    font-family: Arial, Helvetica, sans-serif;
    font-size: 26px;
    margin: 0 0 6px;
    color: var(--ink);
    border-bottom: 3px solid var(--accent);
    padding-bottom: 12px;
  }}
  h2 {{
    font-family: Arial, Helvetica, sans-serif;
    font-size: 19px;
    margin: 34px 0 12px;
    color: var(--accent);
    border-bottom: 1px solid var(--border);
    padding-bottom: 6px;
    page-break-after: avoid;
  }}
  h3 {{
    font-family: Arial, Helvetica, sans-serif;
    font-size: 15px;
    margin: 22px 0 8px;
    color: var(--ink);
    page-break-after: avoid;
  }}
  p {{ margin: 0 0 12px; }}
  p.lead {{
    font-style: italic;
    color: var(--muted);
    font-family: Arial, Helvetica, sans-serif;
    font-size: 13.5px;
    margin-top: -4px;
  }}
  ul {{ margin: 0 0 14px; padding-left: 22px; }}
  li {{ margin-bottom: 6px; }}
  strong {{ color: var(--ink); }}
  code {{
    font-family: 'SFMono-Regular', Consolas, Menlo, monospace;
    background: var(--bg-code);
    padding: 1px 5px;
    border-radius: 3px;
    font-size: 0.9em;
  }}
  hr {{
    border: none;
    border-top: 1px solid var(--border);
    margin: 28px 0;
  }}
  table {{
    width: 100%;
    border-collapse: collapse;
    margin: 14px 0 22px;
    font-family: Arial, Helvetica, sans-serif;
    font-size: 12.5px;
  }}
  caption {{ caption-side: top; text-align: left; }}
  th, td {{
    border: 1px solid var(--border);
    padding: 7px 9px;
    text-align: left;
    vertical-align: top;
  }}
  th {{
    background: var(--bg-table-head);
    font-weight: 700;
  }}
  tr:nth-child(even) td {{ background: #fafbfc; }}
  .footer-note {{
    margin-top: 40px;
    padding-top: 14px;
    border-top: 1px solid var(--border);
    font-size: 12.5px;
    color: var(--muted);
    font-family: Arial, Helvetica, sans-serif;
  }}
  @media print {{
    body {{ font-size: 12.5px; }}
    .page {{ padding: 0 8mm; max-width: none; }}
    h2 {{ page-break-after: avoid; }}
    table, tr {{ page-break-inside: avoid; }}
    a[href]::after {{ content: ""; }}
  }}
  @page {{
    size: letter;
    margin: 18mm 16mm;
  }}
</style>
</head>
<body>
<div class="page">
{body}
</div>
</body>
</html>
"""


def main():
    src = sys.argv[1]
    dst = sys.argv[2]
    with open(src, 'r', encoding='utf-8') as f:
        md = f.read()
    body_html = convert(md)
    # first H1 becomes the title
    title_match = re.search(r'<h1>(.*?)</h1>', body_html)
    title = re.sub(r'<[^>]+>', '', title_match.group(1)) if title_match else 'Document'
    out = TEMPLATE.format(title=html.escape(title), body=body_html)
    with open(dst, 'w', encoding='utf-8') as f:
        f.write(out)
    print(f"wrote {dst} ({len(out)} bytes)")


if __name__ == '__main__':
    main()
