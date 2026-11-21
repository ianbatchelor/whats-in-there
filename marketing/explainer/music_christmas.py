"""Soundtrack for the Christmas short (christmas.html): bells, sleigh bells, a bouncy bass and soft pad,
plus sounds timed to the picture. An original tune, not a carol. Writes a 28.5-second stereo WAV.

python3 music_christmas.py out.wav
"""
import sys
import wave

import numpy as np

SR = 44100
DUR = 28.5
N = int(SR * DUR)
t_all = np.arange(N) / SR
rng = np.random.default_rng(25)
music = np.zeros((2, N))
sfx = np.zeros((2, N))


def midi(n):
    return 440.0 * 2 ** ((n - 69) / 12)


def env(n, a, r):
    e = np.ones(n)
    ai, ri = max(1, int(a * SR)), max(1, int(r * SR))
    e[:ai] = np.linspace(0, 1, ai)
    e[-ri:] *= np.linspace(1, 0, ri)
    return e


def add(buf, start, sig, pan=0.0):
    i = int(start * SR)
    if i >= N or i < 0:
        return
    sig = sig[: N - i]
    buf[0, i : i + len(sig)] += sig * (1 - pan) ** 0.5
    buf[1, i : i + len(sig)] += sig * (1 + pan) ** 0.5


def tone(freqs, dur, decay, amp):
    n = int(dur * SR)
    tt = np.arange(n) / SR
    s = sum(np.sin(2 * np.pi * f * tt) for f in freqs) / len(freqs)
    return s * np.exp(-tt * decay) * env(n, 0.003, 0.02) * amp


def noise(dur, decay, amp, smooth=4):
    n = int(dur * SR)
    s = np.convolve(rng.standard_normal(n), np.ones(smooth) / smooth, mode="same")
    return s * np.exp(-np.arange(n) / SR * decay) * amp


def mix(*parts):
    out = np.zeros(max(len(x) for x in parts))
    for x in parts:
        out[: len(x)] += x
    return out


def glock(note, amp, dur=1.2):
    """A glockenspiel-like bell: a bright fundamental and an inharmonic partial."""
    f = midi(note)
    n = int(dur * SR)
    tt = np.arange(n) / SR
    s = np.sin(2 * np.pi * f * tt) * np.exp(-tt * 3.2) + 0.35 * np.sin(2 * np.pi * f * 2.76 * tt) * np.exp(-tt * 9)
    return s * env(n, 0.002, 0.05) * amp


def sleigh(amp):
    """One shake of sleigh bells: a cluster of tiny high bells."""
    out = np.zeros(int(0.22 * SR))
    for _ in range(7):
        f = rng.uniform(4200, 7800)
        b = tone([f, f * 1.48], 0.18, 26, amp)
        i = int(rng.uniform(0, 0.03) * SR)
        out[i : i + len(b)] += b[: len(out) - i]
    return out


# 120 bpm, a bar is 2 s. C, Am, F, G with a little turnaround.
BEAT = 0.5
CHORDS = [(48, [60, 64, 67]), (45, [57, 60, 64]), (41, [57, 60, 65]), (43, [55, 59, 62])]
# A bell tune, one entry per eighth note (None is a rest), over each four-bar pass.
TUNE = [
    [76, None, 79, 76, 72, None, 74, 76],
    [72, None, 76, 72, 69, None, 72, 74],
    [72, None, 69, 72, 77, None, 76, 74],
    [74, None, 71, 74, 79, None, 77, 74],
]
GROOVE = 4.6  # the full band starts with the logo

for b in range(int(DUR / 2) + 1):
    start = b * 2.0
    root, notes = CHORDS[b % 4]
    # Soft pad all the way through.
    n = int(2.6 * SR)
    tt = np.arange(n) / SR
    pad = sum(np.sin(2 * np.pi * midi(x) * 2 ** (d / 12) * tt) for x in notes for d in (-0.1, 0.1))
    add(music, start, pad * env(n, 0.5, 0.7) * 0.012)
    if start < GROOVE - 0.01 or start > DUR - 3.5:
        continue
    # Bass on beats 1 and 3, a fifth on 3.
    for k, note in ((0, root), (2, root + 7)):
        nb = int(0.45 * SR)
        tb = np.arange(nb) / SR
        bass = (np.sin(2 * np.pi * midi(note) * tb) + 0.3 * np.sin(2 * np.pi * midi(note) * 2 * tb)) * np.exp(-tb * 5)
        add(music, start + k * BEAT, bass * env(nb, 0.005, 0.05) * 0.13)
    # Sleigh bells on every beat, accented on 2 and 4.
    for k in range(4):
        add(music, start + k * BEAT, sleigh(0.05 if k % 2 else 0.03), pan=0.35)
        add(music, start + k * BEAT + BEAT / 2, sleigh(0.018), pan=0.35)
    # The tune, quieter under the busiest scenes.
    for k, note in enumerate(TUNE[b % 4]):
        if note is not None:
            add(music, start + k * BEAT / 2, glock(note, 0.06), pan=-0.25)

# A soft echo, then fades.
for d, g in ((0.375, 0.25), (0.75, 0.1)):
    i = int(d * SR)
    music[:, i:] += g * music[::-1, :-i]
music *= np.clip(t_all / 0.8, 0, 1) * np.clip((DUR - t_all) / 2.5, 0, 1)

# Opening: a bell for each line.
for at, note in ((0.2, 72), (1.2, 76), (1.9, 79), (2.6, 84)):
    add(sfx, at, glock(note, 0.16, 2.0))
# Logo: a swell and a warm bell chord.
n = int(1.0 * SR)
add(sfx, 4.4, noise(1.0, 0, 0.05, 30) * np.linspace(0, 1, n) ** 2 * env(n, 0.01, 0.15))
for k, note in enumerate((60, 64, 67, 72)):
    add(sfx, 4.9 + k * 0.05, glock(note + 12, 0.08, 2.5))
# Presents: paste, details arriving, tap, "you're getting this".
add(sfx, 8.95, mix(noise(0.05, 80, 0.12, 2), tone([1400], 0.06, 50, 0.06)))
add(sfx, 9.95, tone([987.8, 1975.5], 0.5, 7, 0.15))
add(sfx, 10.9, mix(noise(0.05, 80, 0.12, 2), tone([2200], 0.05, 60, 0.05)))
add(sfx, 11.15, tone([1318.5, 2637], 0.9, 4.5, 0.16))
add(sfx, 11.27, tone([1975.5, 3951], 0.9, 4.5, 0.12))
# Mia's phone slides in; her note glows.
add(sfx, 12.2, noise(0.6, 0, 0.05, 12) * np.sin(np.linspace(0, np.pi, int(0.6 * SR))), pan=-0.4)
add(sfx, 13.5, tone([1174.7, 1568], 0.8, 5, 0.12), pan=-0.3)
# Christmas page: a sleigh-bell run.
for k in range(12):
    add(sfx, 16.4 + k * 0.08, sleigh(0.06), pan=rng.uniform(-0.5, 0.5))
# End card: a big bell chord.
for k, note in enumerate((60, 64, 67, 72, 76)):
    add(sfx, 23.3 + k * 0.06, glock(note + 12, 0.09, 4.0))
add(sfx, 23.3, tone([130.8, 196], 3.0, 1.2, 0.12))

mix_ = music + sfx
mix_ /= np.max(np.abs(mix_)) / 0.85
pcm = (mix_.T * 32767).astype(np.int16)
with wave.open(sys.argv[1] if len(sys.argv) > 1 else "christmas.wav", "wb") as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes(pcm.tobytes())
