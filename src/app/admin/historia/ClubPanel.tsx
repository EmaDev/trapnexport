"use client";

import { useState, useTransition } from "react";
import { Button, Input, Textarea, useSnackbar } from "lib-kit-components";

import { guardarClub, type ClubInput } from "@/lib/historia/actions";
import { Bloque, ImageField, ListaEditor, idLocal } from "./campos";

/** Solapa "Club": identidad, palmarés y balance de finales.
 *
 *  Es la única de las siete que **no** es un ABM: no hay filas que crear ni
 *  borrar, es una sola fila que se edita en su lugar. Por eso va como
 *  formulario abierto en la página y no dentro de un `FormModal` como el resto
 *  — abrir un modal para editar el único registro que existe es un click de más
 *  y una pantalla vacía detrás.
 *
 *  Los tres bloques se guardan juntos porque son un solo documento
 *  (`trapnexport-historia/club`): ver `HistoriaClubDoc`.
 */
export function ClubPanel({ inicial }: { inicial: ClubInput }) {
  const { snack } = useSnackbar();
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState<ClubInput>(inicial);

  const set = <K extends keyof ClubInput>(k: K, v: ClubInput[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const submit = () => {
    startTransition(async () => {
      const ok = await guardarClub(form);
      snack({
        message: ok ? "Datos del club guardados" : "Falta el nombre del club",
        variant: ok ? "success" : "error",
      });
    });
  };

  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <Bloque title="Identidad" hint="Sale en el hero de /historia y en la invitación.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Nombre"
            value={form.name}
            maxLength={80}
            onChange={(e) => set("name", e.target.value)}
          />
          <Input
            label="Apodo"
            hint="Cómo le dice la gente"
            value={form.nickname}
            maxLength={40}
            onChange={(e) => set("nickname", e.target.value)}
          />
          <Input
            label="Fundación"
            type="number"
            value={form.founded}
            onChange={(e) => set("founded", Number(e.target.value))}
          />
          <Input
            label="Dónde juega"
            value={form.stadium}
            maxLength={80}
            onChange={(e) => set("stadium", e.target.value)}
          />
          <Input
            label="Colores"
            value={form.colors}
            maxLength={80}
            onChange={(e) => set("colors", e.target.value)}
          />
          <Input
            label="Lema"
            value={form.motto}
            maxLength={120}
            onChange={(e) => set("motto", e.target.value)}
          />
          <Input
            label="Jugadores en la historia"
            hint="El número que sube en el hero"
            type="number"
            value={form.members}
            onChange={(e) => set("members", Number(e.target.value))}
          />
        </div>

        <ImageField
          label="Escudo"
          aspect="1 / 1"
          hint="Se muestra sobre el degradé violeta: conviene un PNG o SVG con fondo transparente, referenciado por URL. La subida convierte a WebP con fondo blanco."
          value={form.crest}
          onChange={(v) => set("crest", v)}
        />

        <Textarea
          label="Párrafo de apertura"
          hint="Lo primero que se lee debajo del hero."
          value={form.intro}
          maxLength={1200}
          showCount
          rows={4}
          autoResize
          onChange={(e) => set("intro", e.target.value)}
        />
      </Bloque>

      <Bloque title="Palmarés" hint="La lista de trofeos, debajo del hero.">
        <ListaEditor
          label="Títulos"
          items={form.trophies}
          onChange={(v) => set("trophies", v)}
          max={40}
          agregar="Agregar título"
          vacio="Sin títulos cargados."
          nuevo={() => ({ id: idLocal("t"), name: "", times: 1, years: "" })}
        >
          {(t, i, setT) => (
            <div className="grid gap-2 sm:grid-cols-[2fr_1fr_1fr]">
              <Input
                label="Torneo"
                value={t.name}
                maxLength={120}
                placeholder="Copa Oro · La Caprichosa"
                onChange={(e) => setT({ ...t, name: e.target.value })}
              />
              <Input
                label="Años"
                value={t.years}
                maxLength={80}
                placeholder="2026"
                onChange={(e) => setT({ ...t, years: e.target.value })}
              />
              <Input
                label="Veces"
                type="number"
                min={1}
                value={t.times}
                onChange={(e) => setT({ ...t, times: Number(e.target.value) })}
              />
            </div>
          )}
        </ListaEditor>
      </Bloque>

      <Bloque
        title="Balance de finales"
        hint="No se calcula del palmarés: las finales perdidas no dejan trofeo, y contarlas desde ahí daría 3 de 3. Cierra el modo presentación."
      >
        <div className="grid gap-4 sm:grid-cols-4">
          {(
            [
              ["finales", "Finales"],
              ["ganadas", "Ganadas"],
              ["perdidas", "Perdidas"],
              ["estrellas", "Estrellas"],
            ] as const
          ).map(([k, label]) => (
            <Input
              key={k}
              label={label}
              type="number"
              min={0}
              value={form.balance[k]}
              onChange={(e) =>
                set("balance", { ...form.balance, [k]: Number(e.target.value) })
              }
            />
          ))}
        </div>
      </Bloque>

      <div className="flex justify-end">
        <Button type="submit" loading={pending} disabled={!form.name.trim()}>
          Guardar datos del club
        </Button>
      </div>
    </form>
  );
}
