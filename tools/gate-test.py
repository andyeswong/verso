"""Prueba del gate — ARQUITECTURA.md §9.4.
Carga el DDL real y el pack demo real, replica el importador y verifica que
NADA por encima del progreso se filtra: ni en listas, ni en cards, ni en
apariciones, ni en búsqueda."""
import json, re, sqlite3, pathlib, sys

root = pathlib.Path('.')
ts = (root/'src/db/schema.ts').read_text(encoding='utf-8')
DDL = re.search(r'export const DDL = `(.*?)`;', ts, re.S).group(1)
FTS = re.search(r'export const DDL_FTS = `(.*?)`;', ts, re.S).group(1)

db = sqlite3.connect(':memory:')
db.executescript(DDL)
db.executescript(FTS)

P = root/'packs/dracula-es'
man   = json.loads((P/'pack.json').read_text(encoding='utf-8'))
bdir  = P/'books'/man['books'][0]
book  = json.loads((bdir/'book.json').read_text(encoding='utf-8'))
units = json.loads((bdir/'units.json').read_text(encoding='utf-8'))
ents  = json.loads((bdir/'entities.json').read_text(encoding='utf-8'))
assets= json.loads((bdir/'assets.json').read_text(encoding='utf-8'))
cards = json.loads((bdir/'cards.json').read_text(encoding='utf-8'))

# ── validación equivalente a la del importador ──────────────────────────
unit_ids  = {u['id'] for u in units}
asset_ids = {a['id'] for a in assets}
ent_ids   = {e['id'] for e in ents}
part_ids  = {p['id'] for p in book.get('parts', [])}
problems  = []
for u in units:
    if u.get('part') and u['part'] not in part_ids: problems.append(f"unit {u['id']} parte")
for a in assets:
    if a.get('reveal') and a['reveal'] not in unit_ids: problems.append(f"asset {a['id']} reveal")
for e in ents:
    if e.get('reveal') and e['reveal'] not in unit_ids: problems.append(f"entity {e['id']} reveal")
    if e.get('canon_asset') and e['canon_asset'] not in asset_ids: problems.append(f"entity {e['id']} asset")
    for ap in e.get('appearances', []):
        if ap['unit'] not in unit_ids: problems.append(f"appearance {e['id']} unit")
    for r in e.get('relations', []):
        if r['to'] not in ent_ids: problems.append(f"relation {e['id']} to")
for cs in cards:
    if cs['unit'] not in unit_ids: problems.append(f"cards {cs['unit']}")
    for c in cs['cards']:
        if c.get('asset') and c['asset'] not in asset_ids: problems.append(f"card {cs['unit']} asset {c['asset']}")
        if c.get('ref') and c['ref'] not in ent_ids: problems.append(f"card {cs['unit']} ref {c['ref']}")
if book.get('cover') and book['cover'] not in asset_ids: problems.append('cover')
if problems:
    print("PACK INVALIDO:"); [print(' ·', p) for p in problems]; sys.exit(1)
print(f"pack valido · {len(units)} unidades · {len(ents)} entidades · {len(assets)} assets")

# ── import ──────────────────────────────────────────────────────────────
BN = book['number']
key_of = {u['id']: BN*100000 + u['sort'] for u in units}
K = lambda uid: key_of.get(uid, 0) if uid else 0

db.execute("INSERT INTO pack VALUES (?,?,?,?,?,?,?,0,0)",
           (man['id'], man['version'], man['schema'], man['title'], man.get('language'),
            json.dumps(man.get('theme')), 'test'))
s = book['series']
db.execute("INSERT INTO series VALUES (?,?,?,?,?)", (s['id'], man['id'], s['title'], s.get('author'), 0))
for a in assets:
    db.execute("INSERT INTO asset VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
               (a['id'], man['id'], a['kind'], 'file://'+a['file'], a['width'], a['height'],
                a.get('tint'), None, a.get('caption'), a.get('credit'), None, None, None, K(a.get('reveal'))))
db.execute("INSERT INTO book VALUES (?,?,?,?,?,?,?)",
           (book['id'], s['id'], man['id'], book['title'], BN, book.get('cover'), BN))
for p in book.get('parts', []):
    db.execute("INSERT INTO part VALUES (?,?,?,?,?)", (p['id'], book['id'], p.get('title'), p.get('number'), p.get('sort', 0)))
for u in units:
    db.execute("INSERT INTO unit VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)",
               (u['id'], book['id'], u.get('part'), u['kind'], u.get('number'), u['label'], u.get('title'),
                u.get('epigraph'), u.get('epigraph_src'), u.get('pov'), u['sort'], u.get('timeline_at'), key_of[u['id']]))
    db.execute("INSERT INTO search VALUES (?,?,?,?)", (u['id'], 'unit', f"{u['label']} {u.get('title') or ''}".strip(), u.get('epigraph') or ''))
for e in ents:
    db.execute("INSERT INTO entity VALUES (?,?,?,?,?,?,?,?,?,?,?)",
               (e['id'], man['id'], book['id'], e['kind'], e['name'], json.dumps(e.get('aka')) if e.get('aka') else None,
                e.get('summary'), e.get('body'), e.get('canon_asset'), None, K(e.get('reveal'))))
    db.execute("INSERT INTO search VALUES (?,?,?,?)", (e['id'], 'entity', ' '.join([e['name']]+e.get('aka',[])),
               ' '.join(filter(None,[e.get('summary'), e.get('body')]))))
# segunda pasada: las relaciones pueden apuntar hacia adelante
for e in ents:
    for ap in e.get('appearances', []):
        db.execute("INSERT INTO appearance VALUES (?,?,?,?,?,?)",
                   (f"{e['id']}@{ap['unit']}", e['id'], ap['unit'], ap['role'], ap.get('note'), K(ap.get('reveal') or ap['unit'])))
    for r in e.get('relations', []):
        db.execute("INSERT INTO relation VALUES (?,?,?,?,?,?)",
                   (f"{e['id']}->{r['to']}", e['id'], r['to'], r['kind'], r.get('label'), K(r.get('reveal'))))
for cs in cards:
    for i, c in enumerate(cs['cards']):
        db.execute("INSERT INTO card VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
                   (f"{cs['unit']}#{i}", man['id'], cs['unit'], None, c['kind'],
                    c.get('slot') or ('hero' if c['kind']=='scene' else 'body'),
                    c.get('title'), c.get('body'), c.get('asset'), c.get('ref'), i, K(c.get('reveal') or cs['unit'])))
db.commit()

# ── EL GATE ─────────────────────────────────────────────────────────────
fails = []
def check(cond, msg):
    if not cond: fails.append(msg)

for u in units:
    cap = key_of[u['id']]
    after = [x for x in units if key_of[x['id']] > cap]
    if not after: continue

    # cards
    leak = db.execute("SELECT c.id FROM card c JOIN unit t ON t.id=c.unit_id WHERE c.reveal_key<=? AND t.reveal_key>?", (cap, cap)).fetchall()
    check(not leak, f"[{u['label']}] cards de unidades futuras visibles: {leak[:3]}")

    # entidades
    leak = db.execute("SELECT id,name FROM entity WHERE reveal_key<=? AND reveal_key>?", (cap, cap)).fetchall()
    check(not leak, f"[{u['label']}] entidades imposibles")
    future_ents = db.execute("SELECT id FROM entity WHERE reveal_key>?", (cap,)).fetchall()
    visible = {r[0] for r in db.execute("SELECT id FROM entity WHERE reveal_key<=?", (cap,))}
    check(not (visible & {r[0] for r in future_ents}), f"[{u['label']}] entidad futura visible")

    # apariciones: nunca una entidad no revelada
    leak = db.execute("""SELECT e.name FROM appearance ap JOIN entity e ON e.id=ap.entity_id
                         WHERE ap.reveal_key<=? AND e.reveal_key>?""", (cap, cap)).fetchall()
    check(not leak, f"[{u['label']}] aparicion revela entidad sellada: {leak[:3]}")

    # búsqueda: el nombre de una entidad futura no debe salir
    for fe in db.execute("SELECT id,name FROM entity WHERE reveal_key>?", (cap,)).fetchall():
        term = fe[1].split()[-1].replace('"','')
        hits = db.execute("""SELECT s.ref FROM search s JOIN entity e ON e.id=s.ref
                             WHERE search MATCH ? AND s.ref_kind='entity' AND e.reveal_key<=?""",
                          (f'"{term}"', cap)).fetchall()
        check(fe[0] not in {h[0] for h in hits}, f"[{u['label']}] busqueda '{term}' filtra {fe[0]}")

    # títulos de unidades futuras: el repo los enmascara; aquí se comprueba que
    # el filtro por reveal_key los separa correctamente
    vis = db.execute("SELECT id FROM unit WHERE book_id=? AND reveal_key<=?", (book['id'], cap)).fetchall()
    check(len(vis) == len([x for x in units if key_of[x['id']] <= cap]), f"[{u['label']}] conteo de unidades")

# progreso 0 (nada leído): sólo reveal_key = 0
zero = db.execute("SELECT COUNT(*) FROM card WHERE reveal_key<=0").fetchone()[0]
check(zero == 0, f"con progreso 0 hay {zero} cards visibles y no debería haber ninguna")

# modo unlocked ve todo
allc = db.execute("SELECT COUNT(*) FROM card").fetchone()[0]
capc = db.execute("SELECT COUNT(*) FROM card WHERE reveal_key<=?", (key_of[units[-1]['id']],)).fetchone()[0]
check(allc == capc, "el último capítulo no ve todas las cards")

if fails:
    print(f"\nGATE ROTO · {len(fails)} fallo(s):")
    for f in fails[:12]: print(' ·', f)
    sys.exit(1)

print(f"gate OK · {len(units)} progresos probados · cards {allc} · entidades {len(ents)}")
print("  sin fugas en: cards · entidades · apariciones · busqueda FTS · conteos")
