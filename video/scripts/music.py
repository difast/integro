"""Спокойная фоновая музыка для ролика — синтезируется с нуля (numpy), без сэмплов и чужих записей.

Длина равна длине ролика, музыка бесшовно повторяется вместе с ним: все события и реверберация
считаются по кругу (хвост из конца переходит в начало). Результат детерминирован (фиксированный seed).

Запуск: python3 scripts/music.py [длительность_с] [выходной_файл.wav]
По умолчанию — 59.6667 с (1790 кадров при 30 кадр/с) и audio/music.wav.
"""

import sys
import wave
from pathlib import Path

import numpy as np

SR = 48_000
DURATION = float(sys.argv[1]) if len(sys.argv) > 1 else 1790 / 30
OUT = Path(sys.argv[2]) if len(sys.argv) > 2 else Path(__file__).resolve().parent.parent / "audio" / "music.wav"

N = int(round(DURATION * SR))
BARS = 16
BAR = DURATION / BARS  # ≈ 3,73 с — около 64 ударов в минуту
rng = np.random.default_rng(20261110)


def hz(midi: float) -> float:
    return 440.0 * 2 ** ((midi - 69) / 12)


def add(buf: np.ndarray, start_s: float, sig: np.ndarray) -> None:
    """Добавляет звук по кругу: всё, что выходит за конец, попадает в начало (бесшовный повтор)."""
    i = int(round(start_s * SR)) % N
    while sig.shape[1]:
        part = sig[:, : N - i]
        buf[:, i : i + part.shape[1]] += part
        sig = sig[:, part.shape[1] :]
        i = 0


def envelope(n: int, attack: float, release: float) -> np.ndarray:
    t = np.arange(n) / SR
    a = np.clip(t / attack, 0, 1)
    r = np.clip((n / SR - t) / release, 0, 1)
    # Плавные (синусоидальные) фронты без щелчков.
    return np.sin(a * np.pi / 2) ** 2 * np.sin(r * np.pi / 2) ** 2


# Гармония: ре мажор, мягкие септ- и нонаккорды; два такта на аккорд, круг из 4 аккордов — дважды.
CHORDS = [
    {"bass": 38, "pad": [54, 57, 61, 64], "arp": [74, 78, 81, 85]},  # Dmaj9
    {"bass": 35, "pad": [50, 54, 57, 61], "arp": [71, 74, 78, 81]},  # Bm9
    {"bass": 31, "pad": [54, 57, 59, 62], "arp": [71, 74, 78, 79]},  # Gmaj9
    {"bass": 33, "pad": [52, 57, 59, 64], "arp": [69, 71, 76, 81]},  # Asus2
]

left_right = np.zeros((2, N))


def pad_note(midi: int, length_s: float, gain: float) -> np.ndarray:
    n = int(length_s * SR)
    t = np.arange(n) / SR
    out = np.zeros((2, n))
    for side, detune in ((0, -5.0), (1, 5.0)):  # лёгкая расстройка влево/вправо — ширина звука
        f = hz(midi + detune / 100)
        vib = 1 + 0.0015 * np.sin(2 * np.pi * (0.17 + 0.03 * side) * t + rng.uniform(0, 6.28))
        phase = 2 * np.pi * f * np.cumsum(vib) / SR
        tone = sum(np.sin(k * phase) / k**1.6 for k in range(1, 6))
        out[side] = tone
    return out * envelope(n, attack=1.6, release=2.4) * gain


def bass_note(midi: int, length_s: float, gain: float) -> np.ndarray:
    n = int(length_s * SR)
    t = np.arange(n) / SR
    f = hz(midi)
    # Основной тон и вторая гармоника — чтобы бас был слышен и на небольших динамиках.
    tone = np.sin(2 * np.pi * f * t) + 0.35 * np.sin(4 * np.pi * f * t)
    mono = tone * envelope(n, attack=0.9, release=1.8) * gain
    return np.vstack([mono, mono])


def keys_note(midi: int, gain: float, pan: float) -> np.ndarray:
    """Мягкое «электропиано»: основной тон с парой обертонов и плавным затуханием."""
    n = int(3.2 * SR)
    t = np.arange(n) / SR
    f = hz(midi)
    tone = (
        np.sin(2 * np.pi * f * t) * np.exp(-t / 1.25)
        + 0.22 * np.sin(4 * np.pi * f * t) * np.exp(-t / 0.5)
        + 0.06 * np.sin(6 * np.pi * f * t) * np.exp(-t / 0.25)
    )
    tone *= np.clip(t / 0.008, 0, 1)
    mono = tone * gain
    return np.vstack([mono * (1 - pan) ** 0.5, mono * (1 + pan) ** 0.5]) / np.sqrt(2)


for bar in range(0, BARS, 2):
    chord = CHORDS[(bar // 2) % len(CHORDS)]
    start = bar * BAR
    length = 2 * BAR + 2.6  # длиннее двух тактов: аккорды плавно перетекают друг в друга
    for midi in chord["pad"]:
        add(left_right, start, pad_note(midi, length, 0.09))
    add(left_right, start, bass_note(chord["bass"], length, 0.22))

    # Перебор появляется со второго круга, тихо и с пропусками — без навязчивого ритма.
    if bar >= 4:
        beat = BAR / 4
        pattern = [0, 2, 1, 3, 2, 1, 3, 0]
        for step, idx in enumerate(pattern):
            if rng.random() < (0.35 if bar < 8 else 0.2):
                continue
            when = start + step * beat + rng.normal(0, 0.012)
            velocity = rng.uniform(0.16, 0.24)
            add(left_right, when, keys_note(chord["arp"][idx], velocity, pan=rng.uniform(-0.45, 0.45)))


def spectral(sig: np.ndarray, fn) -> np.ndarray:
    spec = np.fft.rfft(sig, axis=1)
    freqs = np.fft.rfftfreq(sig.shape[1], 1 / SR)
    return np.fft.irfft(spec * fn(freqs), n=sig.shape[1], axis=1)


# Тёплый тембр: мягкий спад высоких частот и срез инфранизких.
dry = spectral(left_right, lambda f: 1 / np.sqrt(1 + (f / 6500) ** 4) * (f / np.sqrt(f**2 + 30**2 + 1e-9)))

# Реверберация: экспоненциально затухающий шум (разный для каналов), свёртка по кругу через FFT.
ir_len = int(3.2 * SR)
t_ir = np.arange(ir_len) / SR
ir = np.zeros((2, N))
for side in range(2):
    noise = rng.standard_normal(ir_len) * np.exp(-t_ir / 0.75)
    noise = np.convolve(noise, np.ones(24) / 24, mode="same")  # чуть темнее «комната»
    ir[side, :ir_len] = noise / np.sqrt(np.sum(noise**2))
# Бас в реверберацию не отправляется (иначе гул и разная громкость каналов); каналы ревера выравниваются.
send = spectral(dry, lambda f: (f / 220) ** 2 / (1 + (f / 220) ** 2))
wet = np.fft.irfft(np.fft.rfft(send, axis=1) * np.fft.rfft(ir, axis=1), n=N, axis=1)
wet *= np.sqrt(np.mean(wet**2)) / np.sqrt(np.mean(wet**2, axis=1, keepdims=True))
mix = 0.7 * dry + 0.55 * wet
mix *= np.sqrt(np.mean(mix**2)) / np.sqrt(np.mean(mix**2, axis=1, keepdims=True))  # одинаковая громкость каналов

mix /= np.max(np.abs(mix)) / 0.89
pcm = (mix.T * 32767).astype("<i2")
OUT.parent.mkdir(parents=True, exist_ok=True)
with wave.open(str(OUT), "wb") as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes(pcm.tobytes())
print(f"{OUT}: {DURATION:.3f} с, {SR} Гц, стерео")
