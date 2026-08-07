/**
 * 通知ユーティリティ (要件 #2 §9.2)
 * デスクトップ通知 (非フォーカス時のみ) + 通知音 (Web Audio)。
 * 設定は localStorage に保持 (sound / desktop / volume)。
 */
const SOUND_KEY = 'notifySound';
const DESKTOP_KEY = 'notifyDesktop';
const VOLUME_KEY = 'notifyVolume';

function read(key: string, fallback: string): string {
  try {
    return localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}

export function soundEnabled(): boolean {
  return read(SOUND_KEY, 'true') === 'true';
}
export function desktopEnabled(): boolean {
  return read(DESKTOP_KEY, 'true') === 'true';
}
export function soundVolume(): number {
  return Number(read(VOLUME_KEY, '0.6'));
}

/** 通知権限を要求 */
export function requestNotifyPermission(): void {
  if ('Notification' in window && Notification.permission === 'default') {
    void Notification.requestPermission();
  }
}

/** 非フォーカス時のみデスクトップ通知 (#2 §9.2 システム通知) */
export function notify(title: string, body?: string): void {
  if (!desktopEnabled()) return;
  if (document.hasFocus()) return;
  if (!('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;
  try {
    new Notification(title, { body });
  } catch {
    /* notification unavailable */
  }
}

/** 通知音 (Web Audio) — AudioContext は単一インスタンスを再利用 (リーク防止) */
let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (audioCtx) return audioCtx;
  try {
    const Ctx =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    audioCtx = new Ctx();
    return audioCtx;
  } catch {
    return null;
  }
}

export function playSound(): void {
  if (!soundEnabled()) return;
  const ctx = getAudioContext();
  if (!ctx) return;
  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = 880;
    gain.gain.value = soundVolume() * 0.1;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.15);
  } catch {
    /* audio unavailable */
  }
}

/** 完了・エラー・承認要求時の通知 + サウンド */
export function notifyCompletion(message: string): void {
  notify('AME Agent Chat', message);
  playSound();
}
