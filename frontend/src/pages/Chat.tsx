import { useRef, useState } from 'react';
import {
  IonContent,
  IonHeader,
  IonPage,
  IonTitle,
  IonToolbar,
  IonFooter,
  IonTextarea,
  IonButton,
  IonIcon,
  IonSpinner,
  IonChip,
} from '@ionic/react';
import { send, sparklesOutline } from 'ionicons/icons';
import { api, type ChatMsg } from '../api';

const SUGGESTIONS = [
  'Сколько потратили в этом месяце?',
  'На что уходит больше всего?',
  'Сравни этот месяц с прошлым',
  'Как менялась плата за электричество?',
];

export default function Chat() {
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const contentRef = useRef<HTMLIonContentElement>(null);

  const scrollDown = () =>
    setTimeout(() => contentRef.current?.scrollToBottom(300), 50);

  const ask = async (question: string) => {
    const q = question.trim();
    if (!q || busy) return;
    const history = messages;
    setMessages([...history, { role: 'user', content: q }]);
    setInput('');
    setBusy(true);
    scrollDown();
    try {
      const { answer } = await api.aiChat(q, history);
      setMessages((m) => [...m, { role: 'assistant', content: answer }]);
    } catch (e) {
      setMessages((m) => [
        ...m,
        { role: 'assistant', content: `Не удалось получить ответ: ${(e as Error).message}` },
      ]);
    } finally {
      setBusy(false);
      scrollDown();
    }
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Спросить Claude</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent ref={contentRef} className="ion-padding">
        {messages.length === 0 && (
          <div style={{ textAlign: 'center', marginTop: 40 }}>
            <IonIcon icon={sparklesOutline} style={{ fontSize: 48, color: 'var(--ion-color-primary)' }} />
            <h2 style={{ fontWeight: 700 }}>Вопросы про траты</h2>
            <p className="hint" style={{ maxWidth: 320, margin: '0 auto 16px' }}>
              Claude видит все ваши операции и коммуналку. Спросите что угодно —
              суммы, сравнения, динамику.
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
              {SUGGESTIONS.map((s) => (
                <IonChip key={s} onClick={() => ask(s)} color="primary" outline>
                  {s}
                </IonChip>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div
            key={i}
            style={{
              display: 'flex',
              justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start',
              marginBottom: 10,
            }}
          >
            <div
              style={{
                maxWidth: '82%',
                padding: '10px 14px',
                borderRadius: 16,
                whiteSpace: 'pre-wrap',
                lineHeight: 1.4,
                background:
                  m.role === 'user' ? 'var(--ion-color-primary)' : 'rgba(136,136,136,0.20)',
                color: m.role === 'user' ? '#fff' : 'var(--ion-text-color)',
                borderBottomRightRadius: m.role === 'user' ? 4 : 16,
                borderBottomLeftRadius: m.role === 'user' ? 16 : 4,
              }}
            >
              {m.content}
            </div>
          </div>
        ))}

        {busy && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--ion-color-medium)' }}>
            <IonSpinner name="dots" /> Claude думает…
          </div>
        )}
      </IonContent>

      <IonFooter>
        <IonToolbar>
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', padding: '4px 8px' }}>
            <IonTextarea
              placeholder="Спросите про траты…"
              fill="outline"
              autoGrow
              rows={1}
              value={input}
              onIonInput={(e) => setInput(e.detail.value ?? '')}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  ask(input);
                }
              }}
              style={{ flex: 1 }}
            />
            <IonButton onClick={() => ask(input)} disabled={busy || !input.trim()}>
              <IonIcon slot="icon-only" icon={send} />
            </IonButton>
          </div>
        </IonToolbar>
      </IonFooter>
    </IonPage>
  );
}
