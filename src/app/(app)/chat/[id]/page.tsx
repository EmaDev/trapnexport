import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { getCurrentUid } from "@/lib/auth/sesion";
import { getConversationHead, getMessages } from "@/lib/chat/queries";
import { ConversationClient } from "./ConversationClient";

export const metadata: Metadata = {
  title: "Conversación",
  robots: { index: false, follow: false },
};

export default async function ConversationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const uid = await getCurrentUid();
  if (!uid) redirect(`/login?next=/chat/${id}`);

  // `getConversationHead` devuelve `null` también cuando la conversación existe
  // pero no sos participante. Es a propósito que las dos den 404: distinguirlas
  // le diría a cualquiera con un id si esa conversación existe.
  const head = await getConversationHead(id);
  if (!head) notFound();

  const mensajes = await getMessages(id);

  return <ConversationClient head={head} viewerId={uid} mensajes={mensajes} />;
}
