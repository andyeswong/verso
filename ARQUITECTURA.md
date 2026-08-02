# Verso — Arquitectura

> Companion de worldbuilding para los libros que lees.
> Documento de diseño. Precede al código.
> Estado: propuesta para revisión de Andrés · 2026-08-01
> Decisiones de producto que lo originan: ProjectHub `app-worldbuilding-companion`.
>
> *Verso*: la página izquierda de un pliego — la que queda al lado de la que lees.

---

## 0. Qué es

Un lector de worldbuilding que corre **al lado** del libro que estás leyendo.

Hoy: Kindle a 3/4 de la tablet, ChatGPT en 1/4, generando imágenes para visualizar el
mundo. Eso falla en dos cosas — lo generado se pierde en un hilo infinito, y ChatGPT no
sabe dónde vas, así que te spoilea.

La app archiva ese material por capítulo y lo revela conforme avanzas. El contenido
viene precargado en *packs*; el asistente es una consulta lateral, no el centro.

**No es** una app de notas, ni un chat, ni un editor de moodboards.

---

## 1. Alcance

### Fase 1 — la app
Lector completo + importador de packs + asistente. Sin contenido propio: se prueba con
un pack de dominio público.

### Fase 2 — el contenido
Worldbuilding de *El camino de los reyes* generado desde la laptop y entregado como pack.
Requiere trabajo previo de dirección de arte (bloque de mundo de Roshar, hojas de
personaje). Fuera de este documento.

### Explícitamente fuera
- Generación de imagen/video desde el dispositivo.
- Edición de canvas (arrastrar, rotar, componer a mano).
- Sync entre dispositivos, cuentas, backend propio.
- iOS. Android primero; el código no se cierra a iOS pero no se prueba ahí.

---

## 2. Principios

Ocho reglas que resuelven las discusiones de implementación sin volver a preguntar.

1. **El progreso de lectura es la llave.** Todo lo revelable se compara contra él. Lo que
   aún no alcanzas se ve sellado — existe, se cuenta, no se abre.
2. **Las imágenes cuelgan de entidades, no de capítulos.** Un personaje tiene *una* imagen
   canónica que se reusa. Colgarlas del capítulo produce cuarenta Kaladines distintos.
3. **La media vive dentro de la app.** Syncthing entrega; la app se queda con su copia. Se
   lee en vuelos.
4. **320 dp es el ancho de diseño.** Una imagen por fila. Sin rejillas de miniaturas.
5. **El chrome cede al contenido.** La app compite por atención con el libro. Interfaz
   mínima, cero animación llamativa. Lo visual va en las imágenes.
6. **El pack es datos, la app es motor.** Nada del libro se hardcodea. La app no sabe qué
   es Roshar.
7. **Sin red, todo funciona menos el asistente.**
8. **El estado del usuario nunca vive en el pack.** Progreso, notas y media propia
   sobreviven a reinstalar o actualizar un pack.

---

## 3. Modelo de datos

### 3.1 Los tres ejes

Se cruzan pero no se mezclan:

- **Lectura** — `series → book → part → unit`. Lineal, ordenada, es por donde avanzas.
- **Mundo** — `entity`, `appearance`, `relation`. Un grafo. Una entidad vive en muchas
  unidades.
- **Presentación** — `card`, `asset`. Lo que se pinta en pantalla.

`unit` y no `chapter` porque *El camino de los reyes* trae preludio, prólogo, 75
capítulos, nueve interludios y epílogo — del orden de 87 unidades, y sólo 75 son
capítulos.

### 3.2 Esquema

```sql
-- ══════════════════════════════════════════════════════════
-- PACKS
-- ══════════════════════════════════════════════════════════
CREATE TABLE pack (
  id            TEXT PRIMARY KEY,       -- slug del pack
  version       TEXT NOT NULL,          -- semver, para detectar actualizaciones
  title         TEXT NOT NULL,
  language      TEXT NOT NULL,
  theme         TEXT,                   -- JSON: tono del canvas (§6.4)
  source_uri    TEXT,                   -- de dónde se importó
  installed_at  INTEGER NOT NULL,
  updated_at    INTEGER NOT NULL
);

-- ══════════════════════════════════════════════════════════
-- EJE DE LECTURA
-- ══════════════════════════════════════════════════════════
CREATE TABLE series (
  id        TEXT PRIMARY KEY,
  pack_id   TEXT NOT NULL REFERENCES pack(id) ON DELETE CASCADE,
  slug      TEXT NOT NULL,
  title     TEXT NOT NULL,
  author    TEXT,
  sort      INTEGER NOT NULL
);

CREATE TABLE book (
  id            TEXT PRIMARY KEY,
  series_id     TEXT NOT NULL REFERENCES series(id) ON DELETE CASCADE,
  slug          TEXT NOT NULL,
  title         TEXT NOT NULL,
  number        INTEGER NOT NULL,       -- 1 = primero de la saga
  cover_asset   TEXT REFERENCES asset(id),
  sort          INTEGER NOT NULL
);

CREATE TABLE part (
  id       TEXT PRIMARY KEY,
  book_id  TEXT NOT NULL REFERENCES book(id) ON DELETE CASCADE,
  title    TEXT,
  number   INTEGER,
  sort     INTEGER NOT NULL
);

CREATE TABLE unit (
  id           TEXT PRIMARY KEY,
  book_id      TEXT NOT NULL REFERENCES book(id) ON DELETE CASCADE,
  part_id      TEXT REFERENCES part(id),
  kind         TEXT NOT NULL,           -- prelude|prologue|chapter|interlude|epilogue|appendix
  number       INTEGER,                 -- null en preludio/epílogo
  label        TEXT NOT NULL,           -- "XII", "I-3", "Preludio"
  title        TEXT,
  epigraph     TEXT,                    -- Stormlight trae uno por capítulo
  epigraph_src TEXT,
  pov          TEXT,                    -- entity slug, si aplica
  sort         INTEGER NOT NULL,        -- orden de LECTURA
  timeline_at  INTEGER,                 -- orden CRONOLÓGICO (flashbacks)
  reveal_key   INTEGER NOT NULL         -- §3.3
);
CREATE INDEX unit_book_sort ON unit(book_id, sort);

-- ══════════════════════════════════════════════════════════
-- EJE DEL MUNDO
-- ══════════════════════════════════════════════════════════
CREATE TABLE entity (
  id           TEXT PRIMARY KEY,
  pack_id      TEXT NOT NULL REFERENCES pack(id) ON DELETE CASCADE,
  slug         TEXT NOT NULL,
  kind         TEXT NOT NULL,           -- character|place|concept|faction|item|creature|event
  name         TEXT NOT NULL,
  aka          TEXT,                    -- JSON array: alias, para búsqueda
  summary      TEXT,                    -- una línea, spoiler-free al momento de revelarse
  body         TEXT,                    -- markdown, la ficha larga
  canon_asset  TEXT REFERENCES asset(id),
  accent       TEXT,                    -- color opcional de la entidad
  reveal_key   INTEGER NOT NULL
);
CREATE INDEX entity_pack_kind ON entity(pack_id, kind);

-- una entidad en una unidad concreta
CREATE TABLE appearance (
  id          TEXT PRIMARY KEY,
  entity_id   TEXT NOT NULL REFERENCES entity(id) ON DELETE CASCADE,
  unit_id     TEXT NOT NULL REFERENCES unit(id) ON DELETE CASCADE,
  role        TEXT NOT NULL,            -- introduced|appears|mentioned|pov
  note        TEXT,                     -- qué aporta ESTA aparición
  reveal_key  INTEGER NOT NULL
);
CREATE INDEX appearance_unit ON appearance(unit_id);
CREATE INDEX appearance_entity ON appearance(entity_id);

CREATE TABLE relation (
  id          TEXT PRIMARY KEY,
  from_id     TEXT NOT NULL REFERENCES entity(id) ON DELETE CASCADE,
  to_id       TEXT NOT NULL REFERENCES entity(id) ON DELETE CASCADE,
  kind        TEXT NOT NULL,            -- serves|kills|belongs_to|located_in|bonded_to|...
  label       TEXT,                     -- texto mostrable
  reveal_key  INTEGER NOT NULL
);

-- ══════════════════════════════════════════════════════════
-- PRESENTACIÓN
-- ══════════════════════════════════════════════════════════
CREATE TABLE asset (
  id          TEXT PRIMARY KEY,
  pack_id     TEXT REFERENCES pack(id) ON DELETE CASCADE,  -- null = del usuario
  kind        TEXT NOT NULL,            -- image|video
  uri         TEXT NOT NULL,            -- ruta relativa dentro del almacén de la app
  width       INTEGER NOT NULL,
  height      INTEGER NOT NULL,
  blurhash    TEXT,                     -- placeholder sin salto de layout
  duration_ms INTEGER,                  -- video
  caption     TEXT,
  credit      TEXT,                     -- autor humano si lo hay
  prompt      TEXT,                     -- procedencia: cómo se generó
  tool        TEXT,                     -- midjourney|seedance|higgsfield|...
  seed        TEXT,
  reveal_key  INTEGER NOT NULL
);

-- una card es un bloque de la pantalla de unidad o de entidad
CREATE TABLE card (
  id          TEXT PRIMARY KEY,
  unit_id     TEXT REFERENCES unit(id) ON DELETE CASCADE,
  entity_id   TEXT REFERENCES entity(id) ON DELETE CASCADE,
  kind        TEXT NOT NULL,            -- scene|note|quote|entity_ref|media|map
  slot        TEXT NOT NULL,            -- hero|body|aside  (§6.3)
  title       TEXT,
  body        TEXT,                     -- markdown
  asset_id    TEXT REFERENCES asset(id),
  ref_entity  TEXT REFERENCES entity(id),
  sort        INTEGER NOT NULL,
  reveal_key  INTEGER NOT NULL,
  CHECK (unit_id IS NOT NULL OR entity_id IS NOT NULL)
);
CREATE INDEX card_unit ON card(unit_id, sort);
CREATE INDEX card_entity ON card(entity_id, sort);

-- ══════════════════════════════════════════════════════════
-- ESTADO DEL USUARIO — nunca viene del pack, nunca se borra al actualizar
-- ══════════════════════════════════════════════════════════
CREATE TABLE progress (
  book_id     TEXT PRIMARY KEY REFERENCES book(id) ON DELETE CASCADE,
  unit_id     TEXT NOT NULL REFERENCES unit(id),
  reveal_key  INTEGER NOT NULL,         -- desnormalizado: es lo que filtra
  updated_at  INTEGER NOT NULL
);

CREATE TABLE user_note (
  id         TEXT PRIMARY KEY,
  unit_id    TEXT REFERENCES unit(id) ON DELETE CASCADE,
  entity_id  TEXT REFERENCES entity(id) ON DELETE CASCADE,
  body       TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE user_media (
  id         TEXT PRIMARY KEY,
  unit_id    TEXT REFERENCES unit(id) ON DELETE CASCADE,
  entity_id  TEXT REFERENCES entity(id) ON DELETE CASCADE,
  asset_id   TEXT NOT NULL REFERENCES asset(id),
  created_at INTEGER NOT NULL
);

-- ══════════════════════════════════════════════════════════
-- ASISTENTE
-- ══════════════════════════════════════════════════════════
CREATE TABLE chat_thread (
  id          TEXT PRIMARY KEY,
  book_id     TEXT REFERENCES book(id) ON DELETE CASCADE,
  unit_id     TEXT REFERENCES unit(id),  -- dónde ibas al abrirlo
  title       TEXT,
  created_at  INTEGER NOT NULL
);

CREATE TABLE chat_message (
  id          TEXT PRIMARY KEY,
  thread_id   TEXT NOT NULL REFERENCES chat_thread(id) ON DELETE CASCADE,
  role        TEXT NOT NULL,            -- user|assistant
  body        TEXT NOT NULL,
  reveal_key  INTEGER NOT NULL,         -- progreso al momento de preguntar
  model       TEXT,
  created_at  INTEGER NOT NULL,
  pending     INTEGER NOT NULL DEFAULT 0 -- encolado sin red
);
```

### 3.3 El gate — `reveal_key`

Un entero global y comparable. Se calcula al importar:

```
reveal_key = book.number * 100000 + unit.sort
```

Toda tabla revelable lo lleva desnormalizado. El filtro es una comparación de enteros,
sin joins:

```sql
SELECT * FROM card
WHERE unit_id = ?
  AND reveal_key <= (SELECT reveal_key FROM progress WHERE book_id = ?)
ORDER BY sort;
```

Reglas:

- `reveal_key = 0` → siempre visible (mapas de las guardas, dramatis personae,
  glosario introductorio).
- Sin fila en `progress` → sólo se ve `reveal_key = 0`.
- Todo el filtrado vive en **una capa de repositorio**, nunca en los componentes. Un
  `SELECT` crudo desde una pantalla es un bug de spoiler esperando a pasar.
- Las entidades por encima del progreso **se cuentan pero no se listan**: la pantalla de
  unidad dice "3 más aún sin revelar" sin nombrarlas. Se ve que hay mundo, no cuál.

Modo `unlocked`: un ajuste global para libros ya leídos. Explícito, con confirmación, y
visible en la barra mientras esté activo — nunca un estado que se te olvide.

### 3.4 Búsqueda

FTS5 sobre `entity.name + aka + summary + body`, `unit.title + epigraph`,
`card.title + body`, `user_note.body`.

La tabla FTS **no** guarda `reveal_key`; se une con la tabla origen y se filtra ahí. Un
índice de búsqueda que filtra por sí mismo se desincroniza al actualizar un pack.

---

## 4. El pack

### 4.1 Estructura

```
camino-de-reyes-es/
  pack.json                     manifiesto, versión, tema
  series.json                   la saga y sus libros
  books/
    01-camino-de-reyes/
      book.json                 partes
      units.json                las ~87 unidades
      entities.json             el grafo del mundo
      cards.json                qué se pinta en cada unidad
  media/
    kaladin-canon.webp
    ch01-carromato.webp
    syl-vuelo.mp4
    ...
```

JSON y no un `.sqlite` prefabricado: se escribe a mano, se versiona en git, el diff se
lee, y cualquiera arma el suyo con un editor de texto. El binario no da nada de eso.

Archivos separados por tipo porque `entities.json` lo edito muchas veces y `units.json`
casi nunca — un solo archivo gigante hace ilegible cada cambio.

### 4.2 `pack.json`

```json
{
  "id": "camino-de-reyes-es",
  "schema": 1,
  "version": "0.3.0",
  "title": "El camino de los reyes — worldbuilding",
  "language": "es",
  "authors": ["Maia"],
  "license": "personal-use",
  "theme": {
    "canvas":  "#0B0E14",
    "ink":     "#E8E4DC",
    "muted":   "#8A8578",
    "accent":  "#C9A227",
    "texture": "media/_noise.png"
  }
}
```

`schema` es la versión del **formato**, separada de `version` (la del contenido). El
importador rechaza un `schema` que no entiende en vez de importar a medias.

### 4.3 `units.json`

```json
[
  {
    "id": "wok-prelude",
    "kind": "prelude",
    "label": "Preludio",
    "sort": 0,
    "timeline_at": -4500
  },
  {
    "id": "wok-ch01",
    "kind": "chapter",
    "number": 1,
    "label": "1",
    "title": "Tormentabendito",
    "part": "wok-p1",
    "pov": "kaladin",
    "epigraph": "…",
    "epigraph_src": "Recogido el quinto día de la semana Chach…",
    "sort": 3,
    "timeline_at": 100
  }
]
```

`sort` es el orden de lectura; `timeline_at` el cronológico. Distintos a propósito: los
flashbacks se leen en un sitio y ocurren en otro, y eso habilita después una vista de
línea de tiempo.

> Títulos en español a validar contra tu edición. Los del ejemplo son ilustrativos.

### 4.4 `entities.json`

```json
[
  {
    "id": "kaladin",
    "kind": "character",
    "name": "Kaladin",
    "aka": ["Kal"],
    "summary": "Esclavo marcado con el glifo shash.",
    "body": "…markdown…",
    "canon_asset": "kaladin-canon",
    "reveal": "wok-ch01",
    "appearances": [
      { "unit": "wok-ch01", "role": "introduced",
        "note": "Transportado en un carromato de esclavos." }
    ],
    "relations": [
      { "to": "tvlakv", "kind": "captive_of", "reveal": "wok-ch01" }
    ]
  }
]
```

`reveal` es un **id de unidad**, no un número: el importador lo traduce a `reveal_key`.
Así reordenar capítulos no rompe el gate.

Un `reveal` omitido = `0` = siempre visible.

### 4.5 `cards.json`

```json
[
  {
    "unit": "wok-ch01",
    "cards": [
      { "kind": "scene", "slot": "hero", "asset": "ch01-carromato",
        "title": "El carromato" },
      { "kind": "note",  "slot": "body",
        "body": "Lo que el capítulo establece del mundo…" },
      { "kind": "entity_ref", "slot": "body", "ref": "kaladin" },
      { "kind": "entity_ref", "slot": "body", "ref": "tvlakv" }
    ]
  }
]
```

Las cards **referencian** entidades y assets; no los duplican. Es lo que hace que un
personaje tenga una sola imagen en toda la saga.

### 4.6 Media

- Imágenes **4:5** (`1024×1280`) o **9:16**. Nunca 16:9 — en una columna de 320 dp un
  16:9 no ocupa nada. Es la decisión más cara de revertir porque condiciona todos los
  prompts de la fase 2.
- WebP calidad ~80. ~300 KB cada una.
- Video H.264 720p, 5 s, sin audio, ~3.5 MB.
- El `blurhash` lo calcula el importador; no va en el JSON escrito a mano.
- Presupuesto de referencia: 200 imágenes + 30 clips ≈ 165 MB por libro.

### 4.7 Importador

Transaccional. Si algo falla, la base queda como estaba.

```
1. Leer pack.json · validar schema
2. ¿Ya instalado?  →  comparar version  →  actualizar / omitir
3. Validar referencias: todo `reveal`, `asset`, `ref` apunta a algo que existe
4. Copiar media al almacén de la app · calcular blurhash · leer dimensiones
5. Insertar en una transacción · calcular reveal_key
6. Reconstruir índice FTS
7. progress / user_note / user_media INTACTOS
```

Paso 3 antes del 4: validar antes de copiar 165 MB.

**Actualizar un pack no toca el estado del usuario.** Se emparejan por `id`, no por
`rowid`. Si una unidad desaparece en la versión nueva y era tu progreso, el progreso baja
a la unidad anterior existente — nunca sube.

### 4.8 Transporte

**Syncthing es el cartero, no el almacén.**

La tablet ya sincroniza. La app pide **una vez** permiso persistente de directorio
(`StorageAccessFramework.requestDirectoryPermissionsAsync`, disponible en Expo Go), ve los
packs que aparecen ahí, y al importar **copia la media a su propio almacenamiento**.

Esa copia es el requisito del vuelo: no depender de un `content://` a una carpeta que
Syncthing puede mover, y `expo-image` no carga esos URIs de forma confiable.

Segundo camino, mismo importador: **HTTP en LAN**. Un `.zip` servido desde la laptop —
más rápido que esperar el sync mientras iteramos el diseño.

---

## 5. Pantallas

```
Home ─┬─ Unidad ─┬─ Entidad ─── Entidad …
      │          └─ Asistente (con contexto de la unidad)
      ├─ Índice ──── Unidad
      ├─ Biblioteca ─ Libro ─── Índice
      ├─ Búsqueda ── Unidad | Entidad
      └─ Ajustes ─── Packs · Almacenamiento · Asistente · Tema
```

Sin barra de pestañas. En 320 dp cinco iconos abajo se comen el 8% de una pantalla que ya
es angosta, y cuatro de los cinco destinos se visitan una vez por semana.

### 5.1 Home — 320 dp

```
┌──────────────────────────────┐
│  ≡                      ⌕    │   56
├──────────────────────────────┤
│                              │
│  CONTINÚA                    │   label mono, 11, tracking
│  ──────────────────────────  │
│  ┌────────────────────────┐  │
│  │                        │  │
│  │                        │  │
│  │        IMG 4:5         │  │   288 × 360
│  │                        │  │
│  │                        │  │
│  ├────────────────────────┤  │
│  │ 12 · Tormentabendito   │  │   serif 20
│  │ El camino de los reyes │  │   sans 13 muted
│  │ ▓▓▓▓▓▓▓▓░░░░░░░░  16 % │  │   barra 2px
│  └────────────────────────┘  │
│                              │
│  ESTE LIBRO                  │
│  ──────────────────────────  │
│  13   Diez latidos        ›  │   56 de alto cada fila
│  14   Payasadas           ›  │
│  I-1  Interludio · Ishikk ▪  │   ▪ = sellado
│  15   ▪▪▪▪▪▪▪▪            ▪  │
│                              │
│  BIBLIOTECA                  │
│  ──────────────────────────  │
│  El Archivo de las        ›  │
│  Tormentas · 1 libro         │
│                              │
└──────────────────────────────┘
```

La card de continuar es la única con imagen a escala real. Lo demás es lista
tipográfica: en 320 dp una rejilla de portadas es confeti.

Lo sellado se muestra con el título tapado, no oculto. Ver que hay diez capítulos por
delante es parte de la lectura.

### 5.2 Unidad

```
┌──────────────────────────────┐
│  ‹                      ⌕ ⋯  │
├──────────────────────────────┤
│                              │
│         12                   │   serif 56, número solo
│  ─────────────────────────   │
│  TORMENTABENDITO             │   sans caps 13, tracking
│                              │
│  ┌────────────────────────┐  │
│  │  «El epígrafe del      │  │   serif italic 15
│  │   capítulo…»           │  │   sobre superficie sutil
│  │   — recogido el quinto │  │
│  │     día de Chach       │  │
│  └────────────────────────┘  │
│                              │
│  ┌────────────────────────┐  │
│  │                        │  │
│  │       ESCENA           │  │   la imagen fuerte
│  │       IMG 4:5          │  │   288 × 360
│  │                        │  │
│  └────────────────────────┘  │
│  El carromato                │   caption 12 muted
│                              │
│  Nota de contexto en prosa,  │   serif 17/1.6
│  lo que este capítulo        │   ESTO se lee de verdad
│  aporta al mundo. Varios     │
│  párrafos.                   │
│                              │
│  APARECEN                    │
│  ──────────────────────────  │
│  ┌────┐ Kaladin       NUEVO  │   avatar 44
│  │IMG │ Esclavo marcado…     │
│  └────┘                      │
│  ┌────┐ Tvlakv        NUEVO  │
│  │IMG │ Mercader de…         │
│  └────┘                      │
│  ▪ 2 más aún sin revelar     │   se cuentan, no se nombran
│                              │
│  TUYO                        │
│  ──────────────────────────  │
│  + nota      + imagen/video  │
│                              │
├──────────────────────────────┤
│  ‹ 11        [ LEÍDO ]  13 › │   barra fija, zona de pulgar
└──────────────────────────────┘
```

`LEÍDO` avanza el progreso a la siguiente unidad. Es el gesto diario y va donde cae el
pulgar.

### 5.3 Entidad

Misma anatomía, distinto orden: imagen canónica grande → ficha → **apariciones filtradas
por progreso** (una línea por capítulo donde salió, con la nota de esa aparición) →
relaciones reveladas.

La lista de apariciones es lo que la app hace y una wiki no: te dice *dónde lo viste*, no
todo lo que llegará a ser.

### 5.4 Índice

Agrupado por las cinco partes, con los interludios como bloques propios. Salto directo.
87 unidades no caben en un selector de rueda.

### 5.5 Asistente

Pantalla propia, se llega desde `⋯` en la unidad o desde el menú. Nunca encima del
contenido, nunca un botón flotante sobre la lectura.

- Abre con el contexto de dónde estás.
- Cada respuesta lleva marca de **no verificada** y el capítulo con el que se preguntó.
- Sin key configurada, la entrada no existe en el menú.
- Sin red: la pregunta se encola (`pending = 1`) y se dispara al reconectar.

### 5.6 Ajustes

Packs instalados y actualización · almacenamiento con desglose por pack y botón de soltar
media · asistente (base URL, key, modelo) · tema · modo `unlocked`.

---

## 6. Sistema de diseño

Aplica `anti-ai-slop-design` + `landing-aesthetic-practices` + `design-system-bold-typography`
de ProjectHub. Las tres son de web; abajo lo que traduce y lo que no.

### 6.1 Regla de composición

El artefacto del dominio es **el libro**, y en Stormlight la cabecera de capítulo ya viene
compuesta: arco ilustrado, glifo, número, epígrafe. Es una rejilla editorial vertical
regalada. Esa es la anatomía de la pantalla de unidad.

Lo que **no** se hace: corcho con polaroids, hilo rojo, pila de cartas. Es el cliché
inmediato de "app de moodboard".

### 6.2 Tokens

```
radius        0            en todo, sin excepción
espaciado     4 8 12 16 24 32 48 64
regla         1 px         separador; nunca sombras
acento        del pack     sólido, sin gradiente, sin glow
textura       PNG de ruido tileado ~2 %   (fractalNoise SVG no existe barato en RN)
```

### 6.3 Slots

`hero` — una por pantalla, imagen a escala real, ancho completo menos márgenes.
`body` — flujo vertical.
`aside` — epígrafe, caption, procedencia. Registro menor.

Una imagen a escala real o ninguna. Nueve miniaturas en rejilla es decorar una hoja de
cálculo.

### 6.4 Temas — el problema real

La app es sobre todo **imágenes atmosféricas de un mundo de fantasía**, y no habrá dos
sets de assets. Una imagen oscura y brumosa sobre papel `#faf9f6` se ve como una
calcomanía pegada.

Solución en dos capas:

- **Chrome** — sigue el tema del sistema. Home, índice, biblioteca, búsqueda, notas,
  ajustes. Dos temas construidos de verdad, no uno invertido a lo bruto.
- **Canvas** — las pantallas de unidad y entidad usan **el tono del pack**,
  independientemente del sistema. Como una galería: las salas de fotografía son oscuras a
  propósito, no porque el museo tenga modo noche.

La oscuridad como contenido, no como tema.

### 6.5 Tipografía

Se embeben con `expo-font` — en RN es obligatorio, así que el "self-host" que la memoria
pide sale gratis.

Propuesta: **una sola familia serif de texto** (Newsreader — tiene tamaños ópticos e
itálica real) usada en todo el contenido, más un **mono** para labels y metadatos. Una
familia bien explotada da más registro editorial que dos mal elegidas.

- No Instrument Serif/Sans: son de ProjectHub, y la regla es reusar prácticas, nunca
  composiciones.
- No Inter/Roboto/system: delatores.
- No fuentes "de fantasía" (Cinzel, unciales): slop instantáneo.

A validar viendo el render en el dispositivo, no en el papel.

### 6.6 Adaptación

```
compacto   320–400 dp    el cuarto de tablet · teléfono estrecho
regular    400–640 dp    teléfono
ancho      640–900 dp    media tablet   → márgenes mayores, no dos columnas
completo   900+ dp       tablet entera  → índice fijo a la izquierda
```

- `useWindowDimensions`, nunca `Dimensions.get`: el split-screen se redimensiona
  arrastrando el divisor, en vivo.
- Escala tipográfica por breakpoint, no interpolada con el ancho.
- `maxFontSizeMultiplier` en titulares para que el font scaling del sistema no los
  reviente.
- `react-native-safe-area-context`; nada táctil pegado al borde inferior por la barra de
  gestos.

### 6.7 Movimiento

La app corre al lado del libro. Transiciones de 150–200 ms, opacidad y desplazamiento
corto. Sin parallax, sin rebotes, sin nada que pida atención mientras lees otra cosa.

---

## 7. Asistente

Cliente **OpenAI-compatible**: un solo código sirve para FreeRouter y para lo que
configure quien use la app.

- `base_url`, `api_key`, `model` en **SecureStore**. Nunca en SQLite, nunca en el pack,
  nunca en el repo.
- Sin key → la función no existe en la interfaz.

El prompt de sistema lleva: título del libro, unidad actual, y la instrucción de no
revelar nada posterior — *si la respuesta lo requiere, decirlo sin contarlo*.

**Limitación que hay que asumir:** el modelo conoce el libro entero y puede filtrar
aunque se lo prohíbas. Por eso el asistente es secundario y el contenido curado es el
camino principal. Sus respuestas se marcan como no verificadas y no se mezclan con el
material del pack.

---

## 8. Stack

| Pieza | Elección | Por qué |
|---|---|---|
| Runtime | Expo | Expo Go para iterar, APK para usar |
| DB | `expo-sqlite` + FTS5 | En Expo Go; FTS5 incluido |
| Acceso a DB | Drizzle | Migraciones tipadas sobre expo-sqlite, JS puro |
| Imágenes | `expo-image` | blurhash, caché de disco, transición |
| Video | `expo-video` | |
| Archivos | `expo-file-system` | + SAF para la carpeta de Syncthing |
| Secretos | `expo-secure-store` | |
| Listas | FlashList | verificar contra el SDK exacto |
| Animación | Reanimated | en Expo Go |
| Navegación | Expo Router | |
| Fuentes | `expo-font` | |

**Descartado:** `@shopify/react-native-skia` — no está en Expo Go, y era el requisito del
canvas libre pan/zoom. Con plantillas curadas no hace falta.

De las librerías de terceros sólo doy por garantizados los `expo-*`; el resto se verifica
contra el SDK que fijemos.

**Deuda conocida:** los archivos escritos durante la fase Expo Go viven en el sandbox de
Expo Go y **no migran** al APK propio. La media se vuelve a importar. No es grave porque
el pack vive en la laptop.

---

## 9. Verificación

No hay Playwright. El equivalente, y la lección se mantiene íntegra:

1. Capturas reales del dispositivo a **320 / 400 / 640 / 1280 dp**.
2. **Mirarlas.** En Umbral pasaron 23/23 checks y el canvas estaba visiblemente roto. El
   validador no ve la composición.
3. Sin desbordes horizontales en 320.
4. Prueba de gate: fijar progreso en la unidad N y verificar que nada de N+1 aparece —
   ni en listas, ni en búsqueda, ni en relaciones, ni en el asistente.
5. Modo avión: navegar la app completa sin red.
6. Redimensionar el split arrastrando el divisor con la app abierta.

El punto 4 se automatiza. Es el único bug de esta app que no tiene arreglo después de
ocurrir.

---

## 10. Fases

**F1 · Cimientos** — proyecto Expo, esquema, Drizzle, tokens y tipografía, pack demo de
dominio público cargado a mano. Entregable: home y unidad con contenido real en 320 dp.

**F2 · El gate** — progreso, `reveal_key` en la capa de repositorio, estado sellado,
índice, selector. Entregable: la prueba de gate en verde.

**F3 · El mundo** — entidades, apariciones, relaciones, búsqueda FTS.

**F4 · Packs** — importador, SAF sobre Syncthing, HTTP en LAN, actualización sin perder
estado, pantalla de almacenamiento.

**F5 · Lo tuyo** — notas y media propia por unidad y entidad.

**F6 · Asistente** — BYOK, cliente OpenAI-compatible, contexto de progreso, cola offline.

**F7 · APK** — build propio, migración de la fase Expo Go, prueba de vuelo real.

Después: fase 2 del proyecto — el worldbuilding de *El camino de los reyes*.

---

## 11. Abierto

1. **Tipografía** — confirmar Newsreader viéndola en el dispositivo.
2. **Densidad de la tablet** — asumí 2 (`1280×800 dp`). Se verifica al arrancar; si es
   otra, cambia el ancho objetivo.
3. **Dónde vas en el libro** — para no quemarte nada al armar el pack demo ni al empezar
   la fase 2.
4. **Licencia del repo** — MIT o AGPL.
5. **Qué libro de dominio público** para el pack demo del repo.
