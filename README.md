# Verso

Companion de worldbuilding para los libros que lees. Corre al lado del libro —
literalmente: está diseñado para el cuarto de pantalla que queda junto al lector de
ebooks, no para ocupar el teléfono entero.

Lee **packs**: un libro, sus capítulos y el mundo que hay dentro. Todo se revela
conforme avanzas, así que consultar quién era alguien no te adelanta lo que todavía
no has leído.

Diseño y decisiones: [ARQUITECTURA.md](./ARQUITECTURA.md).

## Estado

Fase 1. Funcionan: catálogo, capítulo, entidad, índice, búsqueda, gate de spoilers,
importador de packs y asistente BYOK. Sin build propio todavía; se prueba con Expo Go.

## Correr

```bash
npm install
npm run pack        # sirve el pack de ejemplo en :8788
npm start           # Metro; abrir con Expo Go
```

En la app: **ajustes → importar pack**. La URL por defecto apunta al servidor de
arriba; cámbiala por la IP de tu máquina si hace falta.

## Verificar

```bash
npm run gate        # prueba del gate de spoilers
npx tsc --noEmit    # tipos
```

`npm run gate` carga el DDL real y el pack real, y comprueba que en cada punto de
lectura posible no se filtre nada posterior: ni en listas, ni en cards, ni en
apariciones, ni en el índice de búsqueda. Es la única prueba que no se negocia —
un spoiler no tiene arreglo después de ocurrir.

## Packs

Un pack es JSON más una carpeta de media. No hay nada del libro en el código.

```
mi-pack/
  pack.json
  books/<libro>/{book,units,entities,assets,cards}.json
  media/*.webp
```

Formato completo en ARQUITECTURA.md §4. El de este repo, `packs/dracula-es`, usa
*Drácula* de Bram Stoker (1897, dominio público) y marcadores generados en lugar de
ilustraciones.

**Los packs de libros con derechos no van en este repo.** El motor es abierto; el
contenido de cada quien es suyo y vive en su dispositivo.

## Tipografía

Newsreader y Martian Mono, instanciadas y subseteadas desde las variables de Google
Fonts (SIL Open Font License). El script está en `tools/`.
