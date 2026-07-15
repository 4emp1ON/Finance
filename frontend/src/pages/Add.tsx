import { useRef, useState } from 'react';
import {
  IonContent,
  IonHeader,
  IonPage,
  IonTitle,
  IonToolbar,
  IonSegment,
  IonSegmentButton,
  IonLabel,
  IonInput,
  IonTextarea,
  IonSelect,
  IonSelectOption,
  IonButton,
  IonIcon,
  IonCard,
  IonCardContent,
  IonSpinner,
  IonToast,
  IonNote,
  useIonRouter,
  useIonViewWillEnter,
} from '@ionic/react';
import { cameraOutline, imagesOutline, sparklesOutline } from 'ionicons/icons';
import { api, type Category, type AiParse } from '../api';
import { money } from '../format';

export default function Add() {
  const router = useIonRouter();
  const [mode, setMode] = useState<'manual' | 'ai'>('ai');
  const [cats, setCats] = useState<Category[]>([]);

  // форма
  const [amount, setAmount] = useState('');
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [note, setNote] = useState('');
  const [receiptPath, setReceiptPath] = useState<string | null>(null);

  // ai
  const [aiText, setAiText] = useState('');
  const [aiBusy, setAiBusy] = useState(false);
  const [aiResult, setAiResult] = useState<AiParse | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  const [toast, setToast] = useState('');

  useIonViewWillEnter(() => {
    api.categories().then(setCats);
  });

  const applyAi = (r: AiParse) => {
    setAiResult(r);
    if (r.amount != null) setAmount(String(r.amount));
    if (r.note) setNote(r.note);
    if (r.receiptPath) setReceiptPath(r.receiptPath);
    if (r.category) {
      const c = cats.find((c) => c.name === r.category);
      if (c) setCategoryId(c.id);
    }
    setMode('manual'); // переходим к подтверждению
  };

  const runText = async () => {
    if (!aiText.trim()) return;
    setAiBusy(true);
    try {
      applyAi(await api.aiText(aiText.trim()));
    } catch (e) {
      setToast((e as Error).message);
    } finally {
      setAiBusy(false);
    }
  };

  const runPhoto = async (file: File) => {
    setAiBusy(true);
    try {
      applyAi(await api.aiReceipt(file));
    } catch (e) {
      setToast((e as Error).message);
    } finally {
      setAiBusy(false);
    }
  };

  const save = async () => {
    const amt = parseFloat(amount.replace(',', '.'));
    if (!amt || amt <= 0) {
      setToast('Введите сумму');
      return;
    }
    await api.addTransaction({
      amount: amt,
      categoryId,
      note: note || undefined,
      source: aiResult ? 'ai' : 'manual',
      receiptPath,
    });
    setAmount('');
    setNote('');
    setCategoryId(null);
    setReceiptPath(null);
    setAiResult(null);
    setAiText('');
    setToast('Сохранено');
    router.push('/home');
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Добавить расход</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent className="ion-padding">
        <IonSegment value={mode} onIonChange={(e) => setMode(e.detail.value as 'manual' | 'ai')}>
          <IonSegmentButton value="ai" layout="icon-start">
            <IonIcon icon={sparklesOutline} />
            <IonLabel>Через Claude</IonLabel>
          </IonSegmentButton>
          <IonSegmentButton value="manual" layout="icon-start">
            <IonLabel>Вручную</IonLabel>
          </IonSegmentButton>
        </IonSegment>

        {mode === 'ai' && (
          <div style={{ marginTop: 16 }}>
            <IonCard>
              <IonCardContent>
                <p className="hint" style={{ marginTop: 0 }}>
                  Сфотографируйте чек или опишите трату словами — Claude (Opus)
                  определит сумму и категорию.
                </p>

                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  hidden
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) runPhoto(f);
                    e.target.value = '';
                  }}
                />
                <IonButton
                  expand="block"
                  onClick={() => fileRef.current?.click()}
                  disabled={aiBusy}
                >
                  <IonIcon slot="start" icon={cameraOutline} />
                  Сфотографировать чек
                </IonButton>

                <input
                  ref={galleryRef}
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) runPhoto(f);
                    e.target.value = '';
                  }}
                />
                <IonButton
                  expand="block"
                  fill="outline"
                  style={{ marginTop: 8 }}
                  onClick={() => galleryRef.current?.click()}
                  disabled={aiBusy}
                >
                  <IonIcon slot="start" icon={imagesOutline} />
                  Выбрать из галереи
                </IonButton>

                <div style={{ height: 12 }} />

                <IonTextarea
                  label="Или опишите трату"
                  labelPlacement="stacked"
                  fill="outline"
                  autoGrow
                  placeholder="напр. купил продукты в пятёрочке на 850 рублей"
                  value={aiText}
                  onIonInput={(e) => setAiText(e.detail.value ?? '')}
                />
                <div style={{ height: 8 }} />
                <IonButton expand="block" fill="outline" onClick={runText} disabled={aiBusy}>
                  Разобрать текст
                </IonButton>

                {aiBusy && (
                  <div style={{ textAlign: 'center', marginTop: 16 }}>
                    <IonSpinner />
                    <p className="hint">Claude обрабатывает…</p>
                  </div>
                )}
              </IonCardContent>
            </IonCard>
          </div>
        )}

        {mode === 'manual' && (
          <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
            {aiResult && (
              <IonNote color="primary">
                🤖 Claude предложил: {money(aiResult.amount)} ·{' '}
                {aiResult.category || 'без категории'}. Проверьте и сохраните.
              </IonNote>
            )}
            <IonInput
              type="text"
              inputmode="decimal"
              label="Сумма, ₽"
              labelPlacement="stacked"
              fill="outline"
              placeholder="0"
              value={amount}
              onIonInput={(e) => setAmount(e.detail.value ?? '')}
            />
            <IonSelect
              label="Категория"
              labelPlacement="stacked"
              fill="outline"
              placeholder="Выберите"
              value={categoryId}
              onIonChange={(e) => setCategoryId(e.detail.value)}
            >
              {cats.map((c) => (
                <IonSelectOption key={c.id} value={c.id}>
                  {c.name}
                </IonSelectOption>
              ))}
            </IonSelect>
            <IonInput
              label="Комментарий"
              labelPlacement="stacked"
              fill="outline"
              value={note}
              onIonInput={(e) => setNote(e.detail.value ?? '')}
            />
            {receiptPath && (
              <img
                src={`${import.meta.env.BASE_URL}${receiptPath}`}
                alt="чек"
                style={{ maxHeight: 200, borderRadius: 8, objectFit: 'contain' }}
              />
            )}
            <IonButton expand="block" onClick={save}>
              Сохранить
            </IonButton>
          </div>
        )}

        <IonToast
          isOpen={!!toast}
          message={toast}
          duration={2000}
          onDidDismiss={() => setToast('')}
        />
      </IonContent>
    </IonPage>
  );
}
