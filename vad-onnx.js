// In-process Silero VAD via onnxruntime-node — no Python, no model load on each file.
//
// Public API: getSpeechSegments({ videoPath, ffmpegBin, modelPath, threshold, minGapSeconds,
//                                  minClipDurationSeconds, onProgress, isAborted })
//   → Promise<Array<{ start: number, end: number }>>  (times in seconds)

const ort = require('onnxruntime-node');
const { spawn } = require('child_process');
const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

const SAMPLE_RATE = 16000;
const WINDOW_SIZE = 512;          // Silero v5: advance the audio cursor by 512 samples per call
const CONTEXT_SIZE = 64;          // Last 64 samples of the previous chunk are prepended each call
const INPUT_SIZE = WINDOW_SIZE + CONTEXT_SIZE;  // Model expects 576 = 64 context + 512 new audio
const MIN_SPEECH_DURATION_MS = 250;
const NEG_THRESHOLD_OFFSET = 0.15;
const STATE_SHAPE = [2, 1, 128];
const STATE_LEN = STATE_SHAPE.reduce((a, b) => a * b, 1);

let sessionPromise = null;

function loadSession(modelPath) {
  if (!sessionPromise) {
    sessionPromise = ort.InferenceSession.create(modelPath, {
      executionProviders: ['cpu'],
      graphOptimizationLevel: 'all',
    });
  }
  return sessionPromise;
}

function extractAudioPcm(videoPath, ffmpegBin) {
  const tempPath = path.join(
    os.tmpdir(),
    `sc_vad_${Date.now()}_${crypto.randomBytes(4).toString('hex')}.pcm`
  );
  return new Promise((resolve, reject) => {
    const proc = spawn(
      ffmpegBin,
      ['-y', '-i', videoPath, '-ac', '1', '-ar', String(SAMPLE_RATE), '-vn', '-f', 's16le', tempPath],
      { stdio: ['ignore', 'ignore', 'ignore'] }
    );
    proc.on('close', (code) => {
      if (code === 0) return resolve(tempPath);
      fs.promises.unlink(tempPath).catch(() => {});
      reject(new Error(`ffmpeg exited with code ${code} during VAD audio extraction`));
    });
    proc.on('error', reject);
  });
}

async function readPcmAsFloat32(pcmPath) {
  const buf = await fsp.readFile(pcmPath);
  const samples = new Float32Array(buf.length >> 1);
  for (let i = 0, j = 0; i < buf.length; i += 2, j++) {
    // Little-endian signed 16-bit → [-1, 1)
    samples[j] = buf.readInt16LE(i) / 32768;
  }
  return samples;
}

function decodeSpeechSegments(probs, threshold) {
  // Hysteresis decoder: trigger on prob >= threshold, untrigger on prob < (threshold - 0.15).
  // Reject speech runs shorter than MIN_SPEECH_DURATION_MS to suppress single-window noise.
  const negThreshold = threshold - NEG_THRESHOLD_OFFSET;
  const minSpeechSamples = (MIN_SPEECH_DURATION_MS * SAMPLE_RATE) / 1000;
  const segments = [];
  let triggered = false;
  let currentStart = 0;

  for (let i = 0; i < probs.length; i++) {
    const chunkStartSample = i * WINDOW_SIZE;
    if (probs[i] >= threshold && !triggered) {
      triggered = true;
      currentStart = chunkStartSample;
      continue;
    }
    if (triggered && probs[i] < negThreshold) {
      if (chunkStartSample - currentStart > minSpeechSamples) {
        segments.push({ start: currentStart, end: chunkStartSample });
        triggered = false;
      }
    }
  }
  if (triggered) {
    segments.push({ start: currentStart, end: probs.length * WINDOW_SIZE });
  }
  return segments;
}

function mergeByGap(segments, minGapSeconds) {
  if (segments.length === 0) return [];
  const merged = [];
  let curr = {
    start: segments[0].start / SAMPLE_RATE,
    end: segments[0].end / SAMPLE_RATE,
  };
  for (let i = 1; i < segments.length; i++) {
    const next = {
      start: segments[i].start / SAMPLE_RATE,
      end: segments[i].end / SAMPLE_RATE,
    };
    if (next.start - curr.end < minGapSeconds) {
      curr.end = next.end;
    } else {
      merged.push(curr);
      curr = next;
    }
  }
  merged.push(curr);
  return merged;
}

async function runInference(samples, modelPath, onProgress, isAborted) {
  const session = await loadSession(modelPath);
  const sr = new ort.Tensor('int64', BigInt64Array.from([BigInt(SAMPLE_RATE)]), []);
  let stateData = new Float32Array(STATE_LEN); // zeros == reset_states()
  // Silero's reference OnnxWrapper prepends the last 64 samples of the previous chunk
  // (the "context") to each new 512-sample chunk before inference. Skipping this gives
  // ~zero probabilities on real speech because the LSTM state diverges from training.
  let context = new Float32Array(CONTEXT_SIZE);
  const inputBuffer = new Float32Array(INPUT_SIZE); // reused across windows

  const totalWindows = Math.floor(samples.length / WINDOW_SIZE);
  const probs = new Float32Array(totalWindows);
  let lastReportedPct = 10;

  for (let w = 0; w < totalWindows; w++) {
    if (isAborted && isAborted()) throw new Error('Aborted');

    const offset = w * WINDOW_SIZE;
    inputBuffer.set(context, 0);
    inputBuffer.set(samples.subarray(offset, offset + WINDOW_SIZE), CONTEXT_SIZE);

    const inputTensor = new ort.Tensor('float32', inputBuffer, [1, INPUT_SIZE]);
    const stateTensor = new ort.Tensor('float32', stateData, STATE_SHAPE);

    const result = await session.run({ input: inputTensor, state: stateTensor, sr });
    probs[w] = result.output.data[0];
    stateData = result.stateN.data;

    // Context for the next window = the last 64 samples of this 512-sample chunk.
    // Use slice (copy) — subarray would share memory with the next inputBuffer.set().
    context = samples.slice(offset + WINDOW_SIZE - CONTEXT_SIZE, offset + WINDOW_SIZE);

    // Progress mapping: 0-10% = audio extraction (handled outside), 10-100% = inference.
    if (onProgress) {
      const pct = 10 + Math.floor((w / totalWindows) * 90);
      if (pct > lastReportedPct) {
        onProgress(pct);
        lastReportedPct = pct;
      }
    }
  }
  return probs;
}

async function getSpeechSegments(opts) {
  const {
    videoPath,
    ffmpegBin,
    modelPath,
    threshold = 0.5,
    minGapSeconds = 60,
    minClipDurationSeconds = 0,
    onProgress,
    isAborted,
  } = opts;

  if (!fs.existsSync(modelPath)) {
    throw new Error(`Silero VAD ONNX model not found at: ${modelPath}`);
  }
  if (!fs.existsSync(ffmpegBin)) {
    throw new Error(`ffmpeg binary not found at: ${ffmpegBin}`);
  }

  if (onProgress) onProgress(1);
  const pcmPath = await extractAudioPcm(videoPath, ffmpegBin);
  try {
    if (isAborted && isAborted()) throw new Error('Aborted');
    if (onProgress) onProgress(10);

    const samples = await readPcmAsFloat32(pcmPath);
    const probs = await runInference(samples, modelPath, onProgress, isAborted);

    const raw = decodeSpeechSegments(probs, threshold);
    let merged = mergeByGap(raw, minGapSeconds);

    // Drop segments shorter than the min-clip floor — protects against walk-on music
    // false positives (a real conference talk will never be < 30s).
    if (minClipDurationSeconds > 0) {
      merged = merged.filter((s) => s.end - s.start >= minClipDurationSeconds);
    }

    if (onProgress) onProgress(100);
    return merged;
  } finally {
    fs.promises.unlink(pcmPath).catch(() => {});
  }
}

module.exports = { getSpeechSegments };
