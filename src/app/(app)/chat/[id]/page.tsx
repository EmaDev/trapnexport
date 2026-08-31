import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { sendMessage } from "@/lib/social/actions";
import { getConversation } from "@/lib/social/queries";
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
  const conversation = await getConversation(id);
  if (!conversation) notFound();

  return (
    <ConversationClient
      conversationId={conversation.id}
      peer={conversation.peer}
      messages={conversation.messages}
      onSend={sendMessage}
    />
  );
}
