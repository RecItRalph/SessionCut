import sys
import json
import subprocess
import torch
import os
import tempfile
import warnings
warnings.filterwarnings("ignore")

def read_audio(path):
    import torchaudio
    wav, sr = torchaudio.load(path)
    if wav.size(0) > 1:
        wav = wav.mean(dim=0, keepdim=True)
    if sr != 16000:
        transform = torchaudio.transforms.Resample(orig_freq=sr, new_freq=16000)
        wav = transform(wav)
    return wav.squeeze(0)

def get_speech_timestamps(audio, model, threshold=0.5, sampling_rate=16000, min_speech_duration_ms=250, min_silence_duration_ms=100):
    window_size_samples = 512 if sampling_rate == 16000 else 256
    speech_probs = []
    audio_length_samples = len(audio)
    
    model.reset_states()
    
    # --- PROGRESS TRACKING VARIABLES ---
    last_reported_percent = 0
    
    for i in range(0, audio_length_samples, window_size_samples):
        chunk = audio[i: i+window_size_samples]
        if len(chunk) < window_size_samples:
            break
        output = model(chunk.unsqueeze(0), sampling_rate).item()
        speech_probs.append(output)
        
        # --- CALCULATE & PRINT PROGRESS (10% to 100%) ---
        # We start at 10% because 0-10% is reserved for the ffmpeg extraction step
        current_percent = 10 + int((i / audio_length_samples) * 90)
        
        if current_percent > last_reported_percent:
            print(json.dumps({"status": "progress", "percent": current_percent}))
            sys.stdout.flush() # Force sending to Electron immediately
            last_reported_percent = current_percent
    
    triggered = False
    speeches = []
    current_speech = {}
    
    # Simple hysteresis decoder
    temp_end = 0
    neg_threshold = threshold - 0.15
    
    for i, prob in enumerate(speech_probs):
        chunk_start_sample = i * window_size_samples
        
        if prob >= threshold and not triggered:
            triggered = True
            current_speech['start'] = chunk_start_sample
            continue
            
        if triggered and prob < neg_threshold:
            if (chunk_start_sample - current_speech['start']) > (min_speech_duration_ms * sampling_rate / 1000):
                current_speech['end'] = chunk_start_sample
                speeches.append(current_speech)
                current_speech = {}
                triggered = False
            else:
                pass

    if triggered:
        current_speech['end'] = audio_length_samples
        speeches.append(current_speech)
        
    return speeches

def get_speech_segments(video_path, ffmpeg_path, threshold=0.5, min_gap_seconds=60):
    temp_wav = tempfile.NamedTemporaryFile(suffix=".wav", delete=False)
    temp_wav.close() 
    
    try:
        # Report 1%: Starting Extraction
        print(json.dumps({"status": "progress", "percent": 1}))
        sys.stdout.flush()

        # 1. Use the explicit bundled FFmpeg path
        if not os.path.exists(ffmpeg_path):
             raise FileNotFoundError(f"Bundled FFmpeg not found at: {ffmpeg_path}")

        subprocess.run([
            ffmpeg_path, '-y', '-i', video_path, 
            '-ac', '1', '-ar', '16000', '-vn', temp_wav.name
        ], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)

        # Report 10%: Extraction Done, Loading Model
        print(json.dumps({"status": "progress", "percent": 10}))
        sys.stdout.flush()

        # 2. LOCATE MODEL
        if getattr(sys, 'frozen', False):
            # Production (PyInstaller)
            base_path = os.path.dirname(sys.executable)
            possible_paths = [
                os.path.join(base_path, 'silero_vad.jit'),      # Same folder
                os.path.join(base_path, '..', 'silero_vad.jit') # Up one level (Resources)
            ]
        else:
            # Development (Script)
            base_path = os.path.dirname(os.path.abspath(__file__))
            possible_paths = [
                os.path.join(base_path, 'silero_vad.jit'),          # Root
                os.path.join(base_path, 'assets', 'silero_vad.jit') # Assets folder
            ]
            
        model_path = None
        for p in possible_paths:
            if os.path.exists(p):
                model_path = p
                break
                
        if not model_path:
            raise FileNotFoundError(f"Model not found. Checked: {possible_paths}")

        # 3. Load Model
        model = torch.jit.load(model_path)
        model.eval()

        # 4. Read Audio
        wav = read_audio(temp_wav.name)
        
        # 5. Process (This now handles progress printing from 10% to 100%)
        timestamps = get_speech_timestamps(wav, model, threshold=threshold)
        
        if not timestamps: return []
        
        merged = []
        if len(timestamps) > 0:
            curr_start = timestamps[0]['start'] / 16000
            curr_end = timestamps[0]['end'] / 16000
            
            for i in range(1, len(timestamps)):
                next_start = timestamps[i]['start'] / 16000
                next_end = timestamps[i]['end'] / 16000
                
                if (next_start - curr_end) < min_gap_seconds:
                    curr_end = next_end 
                else:
                    merged.append({"start": curr_start, "end": curr_end})
                    curr_start = next_start
                    curr_end = next_end
                    
            merged.append({"start": curr_start, "end": curr_end})
        
        return merged

    finally:
        if os.path.exists(temp_wav.name):
            try: os.remove(temp_wav.name)
            except: pass

if __name__ == "__main__":
    try:
        # ARGS: [1]VideoPath, [2]FFmpegPath, [3]Threshold, [4]Gap
        input_file = sys.argv[1]
        ffmpeg_bin = sys.argv[2] 
        threshold = 0.5
        if len(sys.argv) > 3: threshold = float(sys.argv[3])
        min_gap = 60
        if len(sys.argv) > 4: min_gap = float(sys.argv[4])

        segments = get_speech_segments(input_file, ffmpeg_bin, threshold, min_gap)
        print(json.dumps({"status": "success", "segments": segments}))

    except Exception as e:
        print(json.dumps({"status": "error", "message": str(e)}))