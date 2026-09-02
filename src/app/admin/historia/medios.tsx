"use client";

import { Input, Switch, Textarea } from "lib-kit-components";

import type { Clip, Photo, Quote } from "@/lib/historia/types";
import { ImageField, ListaEditor, idLocal } from "./campos";

/** Fotos, clips y la frase de cierre: las tres listas que comparten la ficha
 *  de un jugador y la página de una temporada.
 *
 *  Están acá y no duplicadas en cada panel porque son literalmente el mismo
 *  editor: `Season` y `Player` declaran `gallery: Photo[]`, `clips: Clip[]` y
 *  `quote?: Quote` con la misma forma, y las dos pantallas públicas las
 *  renderizan con los mismos componentes (`Carousel`, `ClipRail`,
 *  `QuoteBlock`).
 *
 *  El museo y la sección de video de `/historia` **no** usan esto: ahí las
 *  fotos y los clips son documentos sueltos con su propia tabla, no una lista
 *  embebida dentro de otra cosa. Comparten la forma, no la pantalla.
 */

const anioActual = new Date().getFullYear();

export function FotosEditor({
  items,
  onChange,
  label = "Fotos",
  hint,
}: {
  items: Photo[];
  onChange: (v: Photo[]) => void;
  label?: string;
  hint?: string;
}) {
  return (
    <ListaEditor
      label={label}
      hint={hint}
      items={items}
      onChange={onChange}
      max={40}
      agregar="Agregar foto"
      vacio="Sin fotos cargadas."
      nuevo={(): Photo => ({
        id: idLocal("f"),
        src: "",
        alt: "",
        caption: "",
        year: anioActual,
      })}
    >
      {(f, i, setF) => (
        <>
          <ImageField
            label={`Foto ${i + 1}`}
            value={f.src}
            onChange={(src) => setF({ ...f, src })}
          />
          <div className="grid gap-2 sm:grid-cols-[3fr_1fr]">
            <Input
              label="Epígrafe"
              value={f.caption}
              maxLength={200}
              placeholder="Campeones de la Copa Oro"
              onChange={(e) => setF({ ...f, caption: e.target.value })}
            />
            <Input
              label="Año"
              type="number"
              value={f.year}
              onChange={(e) => setF({ ...f, year: Number(e.target.value) })}
            />
          </div>
          <Input
            label="Texto alternativo"
            hint="Para lectores de pantalla. Vacío, se usa el epígrafe."
            value={f.alt}
            maxLength={160}
            onChange={(e) => setF({ ...f, alt: e.target.value })}
          />
        </>
      )}
    </ListaEditor>
  );
}

export function ClipsEditor({
  items,
  onChange,
  label = "Clips",
  hint,
}: {
  items: Clip[];
  onChange: (v: Clip[]) => void;
  label?: string;
  hint?: string;
}) {
  return (
    <ListaEditor
      label={label}
      hint={hint}
      items={items}
      onChange={onChange}
      max={40}
      agregar="Agregar clip"
      vacio="Sin clips cargados."
      // Anotado a `Clip` a propósito: la fila nueva nace sin `src` —el campo
      // es opcional— y sin la anotación `ListaEditor` deduce un `T` que no lo
      // tiene, con lo que el input de la URL del video no compila.
      nuevo={(): Clip => ({
        id: idLocal("c"),
        title: "",
        description: "",
        year: anioActual,
        duration: "",
        poster: "",
        motion: "",
      })}
    >
      {(c, i, setC) => (
        <>
          <div className="grid gap-2 sm:grid-cols-[3fr_1fr_1fr]">
            <Input
              label="Título"
              value={c.title}
              maxLength={120}
              onChange={(e) => setC({ ...c, title: e.target.value })}
            />
            <Input
              label="Duración"
              hint="Como se muestra"
              value={c.duration}
              maxLength={12}
              placeholder="2:30"
              onChange={(e) => setC({ ...c, duration: e.target.value })}
            />
            <Input
              label="Año"
              type="number"
              value={c.year}
              onChange={(e) => setC({ ...c, year: Number(e.target.value) })}
            />
          </div>

          <Textarea
            label="Descripción"
            value={c.description}
            maxLength={300}
            rows={2}
            autoResize
            onChange={(e) => setC({ ...c, description: e.target.value })}
          />

          <ImageField
            label={`Póster del clip ${i + 1}`}
            value={c.poster}
            onChange={(poster) => setC({ ...c, poster })}
          />

          <Input
            label="URL del video"
            hint="Opcional. Sin video, la tarjeta se queda en el póster."
            value={c.src ?? ""}
            placeholder="https://…/final.mp4"
            onChange={(e) => setC({ ...c, src: e.target.value })}
          />
        </>
      )}
    </ListaEditor>
  );
}

/** La frase de cierre de una temporada o de una ficha.
 *
 *  Es opcional y el switch es lo que la crea o la borra: sin él haría falta
 *  vaciar los cuatro campos a mano para sacarla, y una frase con el texto en
 *  blanco pero el autor cargado es exactamente el estado ambiguo que la acción
 *  tendría que adivinar al guardar.
 */
export function FraseEditor({
  value,
  onChange,
  hint,
}: {
  value: Quote | undefined;
  onChange: (v: Quote | undefined) => void;
  hint?: string;
}) {
  const set = (parcial: Partial<Quote>) =>
    onChange({
      id: value?.id ?? idLocal("q"),
      text: "",
      author: "",
      role: "",
      year: anioActual,
      avatar: "",
      ...value,
      ...parcial,
    });

  return (
    <div className="flex flex-col gap-3">
      <Switch
        checked={!!value}
        onChange={(on) =>
          onChange(
            on
              ? {
                  id: idLocal("q"),
                  text: "",
                  author: "",
                  role: "",
                  year: anioActual,
                  avatar: "",
                }
              : undefined,
          )
        }
        label="Frase de cierre"
        description={hint ?? "La cita que cierra la pantalla."}
      />

      {value && (
        <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface-alt/40 p-3">
          <Textarea
            label="Frase"
            value={value.text}
            maxLength={400}
            rows={2}
            autoResize
            onChange={(e) => set({ text: e.target.value })}
          />
          <div className="grid gap-2 sm:grid-cols-[1fr_2fr_1fr]">
            <Input
              label="Autor"
              value={value.author}
              maxLength={80}
              onChange={(e) => set({ author: e.target.value })}
            />
            <Input
              label="Quién era entonces"
              value={value.role}
              maxLength={120}
              placeholder="Después de la tercera estrella"
              onChange={(e) => set({ role: e.target.value })}
            />
            <Input
              label="Año"
              type="number"
              value={value.year}
              onChange={(e) => set({ year: Number(e.target.value) })}
            />
          </div>
          <ImageField
            label="Avatar"
            aspect="1 / 1"
            value={value.avatar}
            onChange={(avatar) => set({ avatar })}
          />
        </div>
      )}
    </div>
  );
}
