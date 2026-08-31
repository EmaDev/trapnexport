import type { Metadata } from "next";

import { getConversations } from "@/lib/social/queries";
import { ChatListClient } from "./ChatListClient";

export const metadata: Metadata = {
  title: "Mensajes",
  robots: { index: false, follow: false },
};

export default async function ChatPage() {
  const conversations = await getConversations();
  return <ChatListClient conversations={conversations} />;
}
