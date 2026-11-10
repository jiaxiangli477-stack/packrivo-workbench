"""最小常驻出图服务：SD1.5 + diffusers，单进程常驻，HTTP 接口给工作台调用。

启动：python sd_server.py --port 8189
接口：GET  /health          -> {"ok":true,"model":...}
      POST /generate        -> {"prompt":..., "negative":..., "width":768, "height":960}
                              返回 {"ok":true,"file":"...","url":"/api/media/xxx.png","ms":12345}
"""
import argparse
import base64
import json
import os
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import torch
from diffusers import StableDiffusionPipeline, DPMSolverMultistepScheduler

MEDIA = os.path.join(os.getcwd(), "data", "media")
MODEL_PATH = os.environ.get("SD_MODEL", r"E:\Ai\ComfyUI\models\checkpoints\v1-5-pruned-emaonly.safetensors")

_pipe = None


def get_pipe():
    global _pipe
    if _pipe is None:
        pipe = StableDiffusionPipeline.from_single_file(
            MODEL_PATH,
            torch_dtype=torch.float16,
            safety_checker=None,
            requires_safety_checker=False,
        )
        pipe.scheduler = DPMSolverMultistepScheduler.from_config(pipe.scheduler.config)
        pipe.enable_model_cpu_offload()
        pipe.enable_attention_slicing()
        try:
            pipe.enable_vae_slicing()
        except Exception:
            pass
        _pipe = pipe
    return _pipe


class Handler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def _json(self, code, obj):
        body = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("content-type", "application/json; charset=utf-8")
        self.send_header("content-length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if self.path.startswith("/health"):
            try:
                p = get_pipe()
                self._json(200, {"ok": True, "model": MODEL_PATH, "device": str(p.device)})
            except Exception as e:  # noqa: BLE001
                self._json(500, {"ok": False, "error": str(e)[:300]})
        else:
            self._json(404, {"error": "not found"})

    def do_POST(self):
        if not self.path.startswith("/generate"):
            return self._json(404, {"error": "not found"})
        try:
            n = int(self.headers.get("content-length", "0"))
            req = json.loads(self.rfile.read(n) or b"{}")
        except Exception as e:  # noqa: BLE001
            return self._json(400, {"error": "bad json: " + str(e)})

        prompt = (req.get("prompt") or "").strip()
        if not prompt:
            return self._json(400, {"error": "prompt 不能为空"})
        negative = req.get("negative") or "text, watermark, logo, blurry, low quality, deformed, extra fingers"
        width = int(req.get("width") or 512)
        height = int(req.get("height") or 640)
        # 6G 显存：超过 640x800 容易 OOM，按比例压下来
        budget = 512 * 640
        if width * height > budget:
            import math
            k = math.sqrt(budget / float(width * height))
            width = max(384, int(width * k) // 8 * 8)
            height = max(384, int(height * k) // 8 * 8)
        steps = int(req.get("steps") or 20)
        cfg = float(req.get("cfg") or 7.0)
        seed = int(req.get("seed") or 0) or int(time.time()) % 2**31

        os.makedirs(MEDIA, exist_ok=True)
        t0 = time.time()
        try:
            pipe = get_pipe()
            gen = torch.Generator(device="cuda").manual_seed(seed)
            img = pipe(
                prompt=prompt,
                negative_prompt=negative,
                width=width,
                height=height,
                num_inference_steps=steps,
                guidance_scale=cfg,
                generator=gen,
            ).images[0]
            name = "sdx-%d.png" % int(time.time() * 1000)
            path = os.path.join(MEDIA, name)
            img.save(path)
            ms = int((time.time() - t0) * 1000)
            self._json(200, {"ok": True, "file": path.replace("\\", "/"), "name": name, "url": "/api/media/" + name, "ms": ms, "width": width, "height": height, "seed": seed})
        except Exception as e:  # noqa: BLE001
            self._json(500, {"ok": False, "error": str(e)[:400]})


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--port", type=int, default=8189)
    args = ap.parse_args()
    print("loading model ...", flush=True)
    get_pipe()
    print("model ready on cuda", flush=True)
    srv = ThreadingHTTPServer(("127.0.0.1", args.port), Handler)
    print("serving on 127.0.0.1:%d" % args.port, flush=True)
    srv.serve_forever()
