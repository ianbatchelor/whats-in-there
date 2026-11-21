"""Soundtrack for the explainer: a gentle pad, bass and plucked arpeggio, plus sound effects
timed to the on-screen actions in index.html. Writes a 70.6-second stereo WAV.

python3 music.py out.wav
"""
import sys
import wave

import numpy as np

SR = 44100
DUR = 70.6
N = int(SR * DUR)
t_all = np.arange(N) / SR
rng = np.random.default_rng(7)


def midi(n):
    return 440.0 * 2 ** ((n - 69) / 12)


def env(n, a, r, sustain=1.0):
    e = np.full(n, sustain)
    ai = max(1, int(a * SR))
    ri = max(1, int(r * SR))
    e[:ai] = np.linspace(0, sustain, ai)
    e[-ri:] *= np.linspace(1, 0, ri)
    return e


def add(buf, start, sig, pan=0.0):
    i = int(start * SR)
    if i >= N:
        return
    sig = sig[: N - i]
    buf[0, i : i + len(sig)] += sig * (1 - pan) ** 0.5
    buf[1, i : i + len(sig)] += sig * (1 + pan) ** 0.5


music = np.zeros((2, N))
sfx = np.zeros((2, N))

# 96 bpm, one chord per bar (2.5 s). C major: Cmaj9, Am7, Fmaj7, G6sus.
BAR = 2.5
CHORDS = [
    (48, [60, 64, 67, 71, 74]),
    (45, [57, 60, 64, 67, 72]),
    (41, [57, 60, 64, 65, 69]),
    (43, [55, 59, 62, 64, 67]),
]

bars = int(DUR / BAR) + 1
for b in range(bars):
    start = b * BAR
    root, notes = CHORDS[b % 4]
    # Pad: detuned soft saws approximated by a few decaying harmonics.
    n = int((BAR + 0.8) * SR)
    tt = np.arange(n) / SR
    pad = np.zeros(n)
    for note in notes[:4]:
        f = midi(note)
        for det in (-0.12, 0.12):
            ff = f * 2 ** (det / 12)
            for h, amp in ((1, 1.0), (2, 0.28), (3, 0.1)):
                pad += amp * np.sin(2 * np.pi * ff * h * tt + rng.uniform(0, 6.28))
    pad *= env(n, 0.7, 0.9) * 0.010
    add(music, start, pad, pan=-0.15)
    add(music, start, pad * 0.9, pan=0.15)
    # Bass from bar 3 on (after the hook).
    if start >= 6.8:
        nb = int(BAR * SR)
        tb = np.arange(nb) / SR
        bass = (np.sin(2 * np.pi * midi(root) * tb) + 0.25 * np.sin(2 * np.pi * midi(root) * 2 * tb))
        bass *= env(nb, 0.02, 0.5) * np.exp(-tb * 0.5) * 0.09
        add(music, start, bass)
    # Plucked arpeggio in eighths once the walkthrough starts.
    if 6.8 <= start < DUR - 3:
        step = BAR / 8
        pattern = [0, 2, 1, 3, 4, 3, 2, 1]
        for k, idx in enumerate(pattern):
            f = midi(notes[idx] + 12)
            npk = int(0.6 * SR)
            tp = np.arange(npk) / SR
            pl = (np.sin(2 * np.pi * f * tp) + 0.3 * np.sin(2 * np.pi * 2 * f * tp)) * np.exp(-tp * 9)
            pl *= env(npk, 0.004, 0.05) * (0.035 if k % 2 == 0 else 0.025)
            add(music, start + k * step, pl, pan=0.35 if k % 2 else -0.35)

# A soft echo on the music.
for d, g in ((0.375, 0.28), (0.75, 0.12)):
    i = int(d * SR)
    music[:, i:] += g * music[::-1, :-i]

# Fade the music in and out, and dip it under the end card.
fade = np.clip(t_all / 1.5, 0, 1) * np.clip((DUR - t_all) / 3.0, 0, 1)
music *= fade


def tone(freqs, dur, decay, amp):
    n = int(dur * SR)
    tt = np.arange(n) / SR
    s = sum(np.sin(2 * np.pi * f * tt) for f in freqs) / len(freqs)
    return s * np.exp(-tt * decay) * env(n, 0.003, 0.02) * amp


def mix(*parts):
    out = np.zeros(max(len(x) for x in parts))
    for x in parts:
        out[: len(x)] += x
    return out


def noise(dur, decay, amp, smooth=4):
    n = int(dur * SR)
    s = rng.standard_normal(n)
    s = np.convolve(s, np.ones(smooth) / smooth, mode="same")
    return s * np.exp(-np.arange(n) / SR * decay) * amp


# NFC tap: two rising blips.
add(sfx, 14.2, tone([1046.5], 0.18, 18, 0.22))
add(sfx, 14.32, tone([1568], 0.3, 12, 0.2))
# Tap on Add, the shutter and the button.
for tt in (17.7, 23.95 + 0.15):
    add(sfx, tt, noise(0.05, 80, 0.12, 2) + tone([2200], 0.05, 60, 0.05))
add(sfx, 21.0, noise(0.09, 45, 0.3, 3))
add(sfx, 21.07, noise(0.07, 55, 0.22, 3))
# Fields filling in: soft ticks.
for k in range(5):
    add(sfx, 21.9 + k * 0.34, tone([1760], 0.06, 50, 0.07), pan=0.2)
# Added: a bright two-note ding.
add(sfx, 24.3, tone([1318.5, 2637], 0.9, 4.5, 0.18))
add(sfx, 24.42, tone([1975.5, 3951], 0.9, 4.5, 0.14))
# Live: whoosh across, then a notification chime on the other phone.
wn = noise(0.6, 0, 0.06, 12) * np.sin(np.linspace(0, np.pi, int(0.6 * SR)))
add(sfx, 27.0, wn, pan=0.4)
add(sfx, 27.55, tone([1174.7], 0.5, 6, 0.16), pan=-0.3)
add(sfx, 27.7, tone([1568], 0.7, 5, 0.16), pan=-0.3)
# Use first rows landing.
for k in range(7):
    add(sfx, 32.45 + k * 0.14, tone([880 + 60 * k], 0.08, 40, 0.05))
# Typing "tent" and the found pop.
for k in range(4):
    add(sfx, 39.7 + k * 0.18, noise(0.04, 90, 0.1, 2), pan=0.3)
add(sfx, 40.95, tone([784, 1568], 0.5, 7, 0.2))
add(sfx, 41.08, tone([1046.5, 2093], 0.6, 6, 0.16))
# Logo and end card: soft swell and a warm chord.
for at in (6.8, 65.0):
    n = int(1.2 * SR)
    sw = noise(1.2, 0, 0.05, 30) * np.linspace(0, 1, n) ** 2 * env(n, 0.01, 0.15)
    add(sfx, at, sw)
add(sfx, 7.4, tone([523.3, 659.3, 784, 1046.5], 2.5, 1.6, 0.16))
add(sfx, 65.5, tone([523.3, 659.3, 784, 987.8, 1174.7], 4.0, 1.0, 0.16))

# Lists: cards landing, New list, the sheet, typing, choosing who sees it, the new list.
for k in range(6):
    add(sfx, 44.15 + k * 0.12, tone([700 + 50 * k], 0.08, 40, 0.045))
add(sfx, 45.7, noise(0.05, 80, 0.12, 2) + tone([2200], 0.05, 60, 0.05))
add(sfx, 45.85, noise(0.4, 6, 0.04, 20), pan=0.2)
for k in range(8):
    add(sfx, 46.3 + k * 0.08, noise(0.03, 100, 0.08, 2), pan=0.25)
add(sfx, 47.4, noise(0.05, 80, 0.12, 2))
add(sfx, 47.42, tone([1760], 0.12, 25, 0.1))
add(sfx, 48.4, noise(0.4, 6, 0.035, 20), pan=-0.2)
add(sfx, 48.8, tone([784, 1568], 0.5, 7, 0.17))
# Presents: paste, details arriving, "I'm getting this".
add(sfx, 50.95, mix(noise(0.05, 80, 0.12, 2), tone([1400], 0.06, 50, 0.06)))
add(sfx, 51.95, tone([987.8, 1975.5], 0.5, 7, 0.16))
add(sfx, 52.9, noise(0.05, 80, 0.12, 2) + tone([2200], 0.05, 60, 0.05))
add(sfx, 53.15, tone([1318.5, 2637], 0.9, 4.5, 0.17))
add(sfx, 53.27, tone([1975.5, 3951], 0.9, 4.5, 0.13))
add(sfx, 54.2, noise(0.6, 0, 0.05, 12) * np.sin(np.linspace(0, np.pi, int(0.6 * SR))), pan=-0.4)
add(sfx, 55.5, tone([1174.7, 1568], 0.8, 5, 0.12), pan=-0.3)
# Christmas: a little sleigh-bell shimmer.
for k in range(14):
    f = rng.uniform(3200, 6200)
    bell = mix(tone([f, f * 1.51], 0.25, 18, 0.07), noise(0.03, 120, 0.04, 1))
    add(sfx, 58.45 + k * 0.085 + rng.uniform(0, 0.03), bell, pan=rng.uniform(-0.5, 0.5))

mix = music + sfx
mix /= np.max(np.abs(mix)) / 0.85
pcm = (mix.T * 32767).astype(np.int16)
with wave.open(sys.argv[1] if len(sys.argv) > 1 else "music.wav", "wb") as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes(pcm.tobytes())
