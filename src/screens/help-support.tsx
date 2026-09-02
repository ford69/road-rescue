import * as React from 'react';
import { HelpCircle, Mail, MessageSquareWarning, Phone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input, Textarea } from '@/components/ui/input';
import { useToast } from '@/components/ui/toast';
import { useAuth } from '@/context/auth-context';
import { supportApi } from '@/api/repositories';
import { ApiClientError } from '@/api/client/http';

const categories = [
  { value: 'complaint', label: 'Complaint' },
  { value: 'rescue', label: 'Rescue issue' },
  { value: 'account', label: 'Account' },
  { value: 'billing', label: 'Billing / membership' },
  { value: 'other', label: 'Other' },
] as const;

type SupportCategory = (typeof categories)[number]['value'];

export function HelpSupport() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [category, setCategory] = React.useState<SupportCategory>('complaint');
  const [subject, setSubject] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);
  const [submittedId, setSubmittedId] = React.useState<string | null>(null);

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (subject.trim().length < 3 || description.trim().length < 10) {
      toast({
        type: 'error',
        title: 'Please complete the form',
        description: 'Add a short subject and a clear description of your issue.',
      });
      return;
    }

    setSubmitting(true);
    try {
      const ticket = await supportApi.createTicket({
        category,
        subject: subject.trim(),
        description: description.trim(),
      });
      setSubmittedId(ticket.id);
      setSubject('');
      setDescription('');
      setCategory('complaint');
      toast({
        type: 'success',
        title: 'Message sent',
        description: 'Our support team will reply by email as soon as possible.',
      });
    } catch (error) {
      toast({
        type: 'error',
        title: 'Could not send message',
        description:
          error instanceof ApiClientError
            ? error.message
            : 'Please try again or email support@roadrescue4u.com.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-5 pb-4">
      <div>
        <div className="flex items-center gap-2">
          <HelpCircle className="h-5 w-5 text-primary-700" />
          <h1 className="font-display text-2xl font-bold tracking-tight">Help & Support</h1>
        </div>
        <p className="mt-2 text-sm leading-relaxed text-foreground/75">
          Tell us what went wrong or what you need help with. Your message is emailed to our support
          team.
        </p>
      </div>

      <Card className="p-4 sm:p-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <a
            href="mailto:support@roadrescue4u.com"
            className="flex items-center gap-3 rounded-xl border border-border px-4 py-3 transition-colors hover:bg-accent"
          >
            <Mail className="h-5 w-5 text-primary-700" />
            <div>
              <p className="text-sm font-semibold">Email</p>
              <p className="text-xs text-muted-foreground">support@roadrescue4u.com</p>
            </div>
          </a>
          <a
            href="tel:+233000000000"
            className="flex items-center gap-3 rounded-xl border border-border px-4 py-3 transition-colors hover:bg-accent"
          >
            <Phone className="h-5 w-5 text-primary-700" />
            <div>
              <p className="text-sm font-semibold">Call</p>
              <p className="text-xs text-muted-foreground">+233 000 000 000</p>
            </div>
          </a>
        </div>
      </Card>

      <Card className="p-4 sm:p-6">
        <div className="mb-5 flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary-700">
            <MessageSquareWarning className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-display text-lg font-bold">Send a complaint or request</h2>
            <p className="mt-1 text-sm text-foreground/75">
              Signed in as {user?.email}. We will reply to this email address.
            </p>
          </div>
        </div>

        {submittedId && (
          <div className="mb-4 rounded-xl border border-success/30 bg-success/10 px-4 py-3 text-sm">
            Your message was submitted. Reference:{' '}
            <span className="font-semibold">{submittedId}</span>
          </div>
        )}

        <form className="space-y-4" onSubmit={(event) => void onSubmit(event)}>
          <div>
            <label className="mb-1.5 block text-sm font-semibold" htmlFor="support-category">
              Category
            </label>
            <select
              id="support-category"
              value={category}
              onChange={(event) => setCategory(event.target.value as SupportCategory)}
              className="flex h-12 w-full rounded-md border border-input bg-card px-4 text-base text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {categories.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-semibold" htmlFor="support-subject">
              Subject
            </label>
            <Input
              id="support-subject"
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
              placeholder="Brief summary of your issue"
              maxLength={160}
              required
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-semibold" htmlFor="support-description">
              Message
            </label>
            <Textarea
              id="support-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Describe what happened, when it happened, and what you need us to do."
              rows={6}
              maxLength={4000}
              required
            />
            <p className="mt-1 text-xs text-muted-foreground">{description.length}/4000</p>
          </div>

          <Button type="submit" fullWidth size="lg" loading={submitting}>
            Send to support
          </Button>
        </form>
      </Card>
    </div>
  );
}
