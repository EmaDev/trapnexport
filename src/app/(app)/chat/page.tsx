import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { getCurrentUid } from "@/lib/auth/sesion";
import { getContactos, getConversations } from "@/lib/chat/queries";
import { ChatListClient } from "./ChatListClient";

export const metadata: Metadata = {
  title: "Mensajes",
  robots: { index: false, follow: false },
};

export default async function ChatPage() {
  // La bandeja es de alguien: sin sesión no hay nada que listar, y mostrarla
  // vacía se lee como "no tenés mensajes" y no como "no entraste".
  if (!(await getCurrentUid())) redirect("/login?next=/chat");

  const [conversations, contactos] = await Promise.all([getConversations(), getContactos()]);

  return <ChatListClient conversations={conversations} contactos={contactos} />;
}
