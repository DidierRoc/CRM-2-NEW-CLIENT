// Message type extracted from the old useMessaging hook for client-portal use
export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  senderLogin?: string;
  attachment_url?: string | null;
  attachment_name?: string | null;
}
