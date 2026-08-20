import * as React from 'react';
import { Send } from 'lucide-react';
import { Sheet, SheetBody, SheetContent, SheetFooter, SheetHeader } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar } from '@/components/ui/avatar';
import { chatApi } from '@/api/repositories';
import type { ChatMessageDto } from '@/api/types';
import { createTrackingSocket } from '@/lib/socket';
import { useAuth } from '@/context/auth-context';
import { useToast } from '@/components/ui/toast';

function addMessage(current: ChatMessageDto[], next: ChatMessageDto): ChatMessageDto[] {
  return current.some((message) => message._id === next._id) ? current : [...current, next];
}

export function RequestChat({
  requestId,
  recipientName,
  open,
  onOpenChange,
}: {
  requestId: string;
  recipientName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [messages, setMessages] = React.useState<ChatMessageDto[]>([]);
  const [body, setBody] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [sending, setSending] = React.useState(false);
  const endRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    setLoading(true);
    void chatApi
      .list(requestId)
      .then(setMessages)
      .catch((error) =>
        toast({
          type: 'error',
          title: 'Could not load chat',
          description: error instanceof Error ? error.message : 'Try again',
        }),
      )
      .finally(() => setLoading(false));

    const socket = createTrackingSocket();
    socket.on('connect', () => socket.emit('tracking:join', { requestId }));
    socket.on('chat:message', (message: ChatMessageDto) => {
      if (String(message.request) === requestId) {
        setMessages((current) => addMessage(current, message));
      }
    });
    return () => {
      socket.emit('tracking:leave', { requestId });
      socket.disconnect();
    };
  }, [open, requestId, toast]);

  React.useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const send = async (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = body.trim();
    if (!trimmed || sending) return;
    setSending(true);
    try {
      const message = await chatApi.send(requestId, trimmed);
      setMessages((current) => addMessage(current, message));
      setBody('');
    } catch (error) {
      toast({
        type: 'error',
        title: 'Message not sent',
        description: error instanceof Error ? error.message : 'Try again',
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="h-[78vh] bg-card" showHandle>
        <SheetHeader
          title={recipientName}
          description="Messages are linked to this rescue request."
        />
        <SheetBody className="px-4">
          {loading ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Loading messages…</p>
          ) : messages.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No messages yet. Say hello.
            </p>
          ) : (
            <div className="space-y-3 py-2">
              {messages.map((message) => {
                const mine = message.sender._id === user?.id;
                const senderName = `${message.sender.firstName} ${message.sender.lastName}`;
                return (
                  <div
                    key={message._id}
                    className={`flex items-end gap-2 ${mine ? 'justify-end' : 'justify-start'}`}
                  >
                    {!mine && (
                      <Avatar
                        src={message.sender.avatar}
                        fallback={`${message.sender.firstName[0]}${message.sender.lastName[0]}`}
                        size="xs"
                      />
                    )}
                    <div
                      className={`max-w-[78%] rounded-2xl px-3 py-2 ${
                        mine
                          ? 'rounded-br-md bg-primary text-primary-foreground'
                          : 'rounded-bl-md bg-accent text-foreground'
                      }`}
                    >
                      {!mine && <p className="mb-0.5 text-[10px] font-semibold">{senderName}</p>}
                      <p className="whitespace-pre-wrap break-words text-sm">{message.body}</p>
                      <p className={`mt-1 text-[10px] ${mine ? 'opacity-70' : 'text-muted-foreground'}`}>
                        {new Date(message.createdAt).toLocaleTimeString('en-GH', {
                          hour: 'numeric',
                          minute: '2-digit',
                        })}
                      </p>
                    </div>
                  </div>
                );
              })}
              <div ref={endRef} />
            </div>
          )}
        </SheetBody>
        <SheetFooter>
          <form className="flex gap-2" onSubmit={send}>
            <Input
              value={body}
              onChange={(event) => setBody(event.target.value)}
              placeholder="Type a message…"
              maxLength={1000}
            />
            <Button type="submit" size="icon" disabled={!body.trim() || sending}>
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
