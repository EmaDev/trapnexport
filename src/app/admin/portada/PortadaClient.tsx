"use client";

import { useState, useTransition } from "react";
import {
  Button,
  Card,
  Carousel,
  DatePicker,
  Input,
  Select,
  Switch,
  TimePicker,
  useSnackbar,
} from "lib-kit-components";

import { CountdownHero } from "@/components/organisms/CountdownHero";
import { savePortada } from "@/lib/contenido/actions";
import {
  MAX_SLIDES,
  PORTADA_VACIA,
  type CuentaRegresiva,
  type OrigenCuentaRegresiva,
  type PortadaInput,
  type SlidePortada,
} from "@/lib/contenido/types";
import { subirImagenPortada } from "@/lib/storage/portada-image";
import { fromISODate, isoShort, longDate } from "@/lib/time";
import { Bloque, ImageField, ListaEditor } from "../historia/campos";

/** La portada de la home: cuenta regresiva y carrusel.
 *
 *  No es un ABM: como la solapa "Club" de la historia, es **una sola fila** que
 *  se edita en su lugar, así que va como formulario abierto y no dentro de un
 *  `FormModal`. Los dos bloques se guardan juntos porque son un solo documento
 *  (`trapnexport-config/portada`): ver `PortadaConfigDoc`.
 *
 *  Las dos mitades llevan vista previa con **los mismos componentes que la
 *  home** —`CountdownHero` y `Carousel`—, no una maqueta parecida. Es lo que
 *  hace que elegir "falta poco" o un epígrafe de 60 caracteres sea una decisión
 *  informada: la portada es la única pantalla que ve todo el mundo antes de
 *  tocar nada.
 */

const ORIGENES: { value: OrigenCuentaRegresiva; label: string }[] = [
  { value: "cronograma", label: "El día del cronograma" },
  { value: "fija", label: "Una fecha fija" },
];

const toISO = (d: Date): string => {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

const SLIDE_VACIO: SlidePortada = { src: "", alt: "", caption: "" };

export function PortadaClient({
  inicial,
  fechaCronograma,
  fechaLargaCronograma,
  eventos,
}: {
  inicial: PortadaInput;
  /** "YYYY-MM-DD" — el día que hoy tiene el cronograma */
  fechaCronograma: string;
  fechaLargaCronograma: string;
  /** los eventos de ese día, en orden: el primero es el que fija la hora */
  eventos: { nombre: string; hora: string }[];
}) {
  const { snack } = useSnackbar();
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState<PortadaInput>(inicial);

  const { countdown, slides } = form;

  const set = <K extends keyof CuentaRegresiva>(k: K, v: CuentaRegresiva[K]) =>
    setForm((f) => ({ ...f, countdown: { ...f.countdown, [k]: v } }));

  /** El objetivo tal como lo va a resolver `getPortada()`: con origen
   *  `cronograma`, el día del cronograma y la hora del primer evento. La vista
   *  previa cuenta a esto y no a los campos crudos, que es la única forma de
   *  ver que atar el contador al cronograma apunta a donde se espera. */
  const atadoAlCronograma = countdown.origen === "cronograma";
  const primero = eventos[0];
  const fecha = atadoAlCronograma ? fechaCronograma : countdown.fecha;
  const hora = atadoAlCronograma
    ? (primero?.hora ?? PORTADA_VACIA.countdown.hora)
    : countdown.hora;
  const titulo = atadoAlCronograma
    ? countdown.titulo || primero?.nombre || ""
    : countdown.titulo;

  const submit = () => {
    startTransition(async () => {
      const ok = await savePortada(form);
      snack({
        message: ok
          ? "Portada guardada"
          : "Elegí la fecha a la que cuenta, o atalo al cronograma",
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
      {/* ── cuenta regresiva ─────────────────────────────────────────────── */}
      <Bloque
        title="Cuenta regresiva"
        hint="El contador grande que presiden la home, dentro de la card del header."
      >
        <Switch
          checked={countdown.activa}
          onChange={(v) => set("activa", v)}
          label="Mostrar el contador"
          description={
            countdown.activa
              ? "Se ve en la home de todos."
              : "La home queda sin contador, con el escudo y el carrusel."
          }
        />

        {/* Tres columnas con fecha fija (origen, día y hora) y dos cuando está
            atado al cronograma, donde el día y la hora son un resumen y no dos
            campos. */}
        <div
          className={`grid gap-4 ${atadoAlCronograma ? "sm:grid-cols-2" : "sm:grid-cols-3"}`}
        >
          <Select
            label="Cuenta hasta"
            options={ORIGENES}
            value={countdown.origen}
            onChange={(v) => set("origen", v as OrigenCuentaRegresiva)}
            hint={
              atadoAlCronograma
                ? `Hoy: ${fechaLargaCronograma}. Mover el cronograma mueve el contador.`
                : "Para lo que no es el evento: el lanzamiento, el cierre de una votación."
            }
          />

          {/* La hora sale del primer evento del día cuando está atado: cargarla
              acá además daría dos horas de arranque para el mismo día, y la que
              manda sería la que no se está mirando. */}
          {atadoAlCronograma ? (
            <div className="flex flex-col justify-center rounded-xl border border-border bg-surface-alt/40 px-3 py-2">
              <p className="text-xs font-medium uppercase tracking-wide text-muted">
                Arranca
              </p>
              <p className="mt-0.5 text-sm font-semibold tabular-nums">
                {isoShort(fechaCronograma)} · {hora}
              </p>
              <p className="mt-0.5 text-xs text-muted">
                {primero
                  ? `Hora del primer evento: ${primero.nombre}`
                  : "El cronograma está vacío, así que cae en la hora por defecto."}
              </p>
            </div>
          ) : (
            <>
              <DatePicker
                label="Día"
                value={countdown.fecha ? fromISODate(countdown.fecha) : null}
                onChange={(v) => set("fecha", v instanceof Date ? toISO(v) : "")}
                weekStartsOn={1}
                locale="es-AR"
                clearable
              />
              <TimePicker
                label="Hora"
                value={countdown.hora}
                onChange={(v) => set("hora", v ?? PORTADA_VACIA.countdown.hora)}
                step={15}
              />
            </>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Texto de arriba"
            value={countdown.eyebrow}
            maxLength={40}
            placeholder={PORTADA_VACIA.countdown.eyebrow}
            onChange={(e) => set("eyebrow", e.target.value)}
            hint="En mayúsculas chicas, arriba de los números."
          />
          <Input
            label="Título"
            value={countdown.titulo}
            maxLength={80}
            placeholder={atadoAlCronograma ? (primero?.nombre ?? "Opcional") : "Opcional"}
            onChange={(e) => set("titulo", e.target.value)}
            hint={
              atadoAlCronograma
                ? "Vacío usa el nombre del primer evento del cronograma."
                : "La línea debajo del texto de arriba."
            }
          />
        </div>

        <Input
          label="Al llegar a cero"
          value={countdown.mensajeFinal}
          maxLength={80}
          placeholder={PORTADA_VACIA.countdown.mensajeFinal}
          onChange={(e) => set("mensajeFinal", e.target.value)}
          hint="Reemplaza a los números cuando la fecha pasa."
        />

        {/* Vista previa: el mismo componente de la home, con el mismo tamaño y
            tono. Sin fecha no hay nada que contar, así que dice qué falta. */}
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium">Así se ve en la home</p>
          <Card variant="outline" padding="md" className="bg-surface-alt/40">
            {!countdown.activa ? (
              <p className="py-6 text-center text-sm text-muted">
                El contador está apagado.
              </p>
            ) : fecha ? (
              <>
                <CountdownHero
                  until={fromISODate(fecha, hora)}
                  variant="blocks"
                  size="xl"
                  tone="surface"
                  eyebrow={countdown.eyebrow || PORTADA_VACIA.countdown.eyebrow}
                  title={titulo || undefined}
                  expiredMessage={
                    countdown.mensajeFinal || PORTADA_VACIA.countdown.mensajeFinal
                  }
                />
                <p className="mt-2 text-center text-xs capitalize text-muted">
                  {longDate(fecha)} · {hora}
                </p>
              </>
            ) : (
              <p className="py-6 text-center text-sm text-muted">
                Elegí el día al que cuenta.
              </p>
            )}
          </Card>
        </div>
      </Bloque>

      {/* ── carrusel ─────────────────────────────────────────────────────── */}
      <Bloque
        title="Carrusel"
        hint="Las imágenes que pasan debajo del header, en 16:9. Avanzan solas cada 5 segundos."
      >
        <ListaEditor
          label="Imágenes"
          hint="El orden es el de la lista. Sin ninguna, la home muestra las imágenes de relleno."
          items={slides}
          onChange={(v) => setForm((f) => ({ ...f, slides: v }))}
          nuevo={() => ({ ...SLIDE_VACIO })}
          max={MAX_SLIDES}
          agregar="Agregar imagen"
          vacio="Todavía no hay imágenes cargadas."
        >
          {(slide, i, setSlide) => (
            <>
              <ImageField
                label={`Imagen ${i + 1}`}
                value={slide.src}
                onChange={(src) => setSlide({ ...slide, src })}
                subir={subirImagenPortada}
                hint="Subí una imagen o pegá una URL. Se recorta en 16:9."
              />
              <div className="grid gap-2 sm:grid-cols-2">
                <Input
                  label="Epígrafe"
                  value={slide.caption}
                  maxLength={80}
                  placeholder="Falta poco"
                  onChange={(e) => setSlide({ ...slide, caption: e.target.value })}
                  hint="Se dibuja encima de la imagen. Opcional."
                />
                <Input
                  label="Texto alternativo"
                  value={slide.alt}
                  maxLength={120}
                  placeholder="Qué se ve en la foto"
                  onChange={(e) => setSlide({ ...slide, alt: e.target.value })}
                  hint="Lo que lee quien no ve la imagen."
                />
              </div>
            </>
          )}
        </ListaEditor>

        {/* Las filas sin imagen no entran: son las que se acaban de agregar, y
            el servidor las descarta igual al guardar. */}
        {slides.some((s) => s.src) && (
          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium">Así se ve en la home</p>
            <Carousel
              images={slides
                .filter((s) => s.src)
                .map((s) => ({ src: s.src, alt: s.alt, caption: s.caption || undefined }))}
              aspect={16 / 9}
              loop
              dots
              arrows
              className="overflow-hidden rounded-2xl"
            />
          </div>
        )}
      </Bloque>

      <div className="flex justify-end">
        <Button type="submit" loading={pending}>
          Guardar portada
        </Button>
      </div>
    </form>
  );
}
