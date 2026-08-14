"""Extraction de méthodes depuis un objet littéral JS dans un fichier unique.

La coupe se fait par appariement d'accolades avec une pile de contextes, et non
par regex de fin : les corps contiennent des templates avec interpolation
(`...${expr}...`), des objets imbriqués, des accolades dans des chaînes et des
commentaires. Une pile est nécessaire parce qu'une interpolation peut elle-même
contenir un template.
"""
import re


def _scan_body(src, open_brace, limit):
    """Retourne l'index du `}` fermant le bloc ouvert en `open_brace`."""
    i = open_brace
    # pile de modes : 'code' | 'sq' | 'dq' | 'tpl' | 'line' | 'block'
    stack = ['code']
    depth = 0
    while i < limit:
        mode = stack[-1]
        c = src[i]
        nxt = src[i + 1:i + 2]

        if mode == 'line':
            if c == '\n':
                stack.pop()
            i += 1
            continue
        if mode == 'block':
            if c == '*' and nxt == '/':
                stack.pop()
                i += 2
                continue
            i += 1
            continue
        if mode in ('sq', 'dq'):
            if c == '\\':
                i += 2
                continue
            if (mode == 'sq' and c == "'") or (mode == 'dq' and c == '"'):
                stack.pop()
            i += 1
            continue
        if mode == 'tpl':
            if c == '\\':
                i += 2
                continue
            if c == '`':
                stack.pop()
                i += 1
                continue
            if c == '$' and nxt == '{':
                # on entre dans du code : l'accolade sera équilibrée par le '}'
                stack.append('code')
                depth += 1
                i += 2
                continue
            i += 1
            continue

        # --- mode code ---
        if c == '/' and nxt == '/':
            stack.append('line')
            i += 2
            continue
        if c == '/' and nxt == '*':
            stack.append('block')
            i += 2
            continue
        if c == "'":
            stack.append('sq')
            i += 1
            continue
        if c == '"':
            stack.append('dq')
            i += 1
            continue
        if c == '`':
            stack.append('tpl')
            i += 1
            continue
        if c == '{':
            depth += 1
            i += 1
            continue
        if c == '}':
            depth -= 1
            if len(stack) > 1:
                # fin d'une interpolation : on retourne dans le template
                stack.pop()
                i += 1
                continue
            if depth == 0:
                return i
            i += 1
            continue
        i += 1
    raise ValueError('accolade fermante introuvable')


def find_method(src, name, obj_start, obj_end):
    """Retourne (start, end) de la méthode `name` dans [obj_start, obj_end)."""
    pat = re.compile(r'^  (?:async\s+)?' + re.escape(name) + r'\s*\([^)]*\)\s*\{', re.M)
    m = pat.search(src, obj_start, obj_end)
    if not m:
        return None
    start = m.start()
    # inclure un bloc de commentaire /** ... */ ou // qui précède immédiatement
    prev_nl = src.rfind('\n', 0, start - 1)
    prev_line = src[prev_nl + 1:start - 1] if prev_nl != -1 else ''
    if prev_line.strip().endswith('*/'):
        cstart = src.rfind('/*', 0, start)
        if cstart != -1:
            line_head = src.rfind('\n', 0, cstart) + 1
            if src[line_head:cstart].strip() == '':
                start = line_head
    close = _scan_body(src, m.end() - 1, obj_end)
    end = close + 1
    if src[end:end + 1] == ',':
        end += 1
    if src[end:end + 1] == '\n':
        end += 1
    return start, end


def cut_methods(src, names, obj_start, obj_end):
    """Coupe plusieurs méthodes. Coupe de la fin vers le début pour préserver
    les index, et vérifie que chaque span reste plausible."""
    spans = []
    for n in names:
        r = find_method(src, n, obj_start, obj_end)
        if not r:
            raise SystemExit('méthode introuvable: ' + n)
        a, b = r
        if b - a > 12000:
            raise SystemExit(f'span suspect pour {n}: {b - a} chars — coupe refusée')
        spans.append((a, b, n))
    spans.sort(key=lambda s: -s[0])
    # aucun chevauchement
    for i in range(len(spans) - 1):
        if spans[i][0] < spans[i + 1][1]:
            raise SystemExit(f'spans chevauchants: {spans[i][2]} / {spans[i + 1][2]}')
    cut = {}
    for a, b, n in spans:
        cut[n] = src[a:b]
        src = src[:a] + src[b:]
    return src, cut
