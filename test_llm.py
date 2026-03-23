import os
os.environ["HF_HUB_DISABLE_SYMLINKS_WARNING"] = "1"
import torch
from transformers import pipeline

try:
    device = 0 if torch.cuda.is_available() else -1
    print(f"Loading Qwen/Qwen2.5-0.5B-Instruct on device {device}...")
    p = pipeline("text-generation", model="Qwen/Qwen2.5-0.5B-Instruct", device=device)
    print("SUCCESS")
except Exception as e:
    import traceback
    traceback.print_exc()
