"""Add independent LAION/CLIP aesthetic and observable technical quality scores."""
import argparse
import hashlib
import json
from pathlib import Path
import numpy as np
import open_clip
import torch
from PIL import Image, ImageOps, ImageFilter

ROOT = Path(__file__).resolve().parents[1]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--head", type=Path, required=True)
    parser.add_argument("--cache", type=Path, required=True)
    args = parser.parse_args()
    source = ROOT / "reports/card-art/scores.json"
    data = json.loads(source.read_text(encoding="utf-8"))
    torch.set_num_threads(4)
    model, _, preprocess = open_clip.create_model_and_transforms('ViT-B-32-quickgelu', pretrained='openai', cache_dir=str(args.cache))
    model.eval()
    head = torch.nn.Linear(512, 1)
    head.load_state_dict(torch.load(args.head, map_location='cpu', weights_only=True))
    head.eval()
    for index, row in enumerate(data['cards']):
        path = ROOT / 'src/main/resources/static' / row['image'].removeprefix('./')
        with Image.open(path) as opened:
            image = ImageOps.exif_transpose(opened).convert('RGB')
            with torch.inference_mode():
                embedding = model.encode_image(preprocess(image).unsqueeze(0))
                embedding /= embedding.norm(dim=-1, keepdim=True)
                general = float(head(embedding.float()).item())
            # Technical legibility only. No claim of watermark/anatomy/composition detection.
            gray = np.asarray(image.resize((256, 256)).convert('L'), dtype=np.float32)
            lap = -4 * gray[1:-1, 1:-1] + gray[:-2, 1:-1] + gray[2:, 1:-1] + gray[1:-1, :-2] + gray[1:-1, 2:]
            sharpness = float(lap.var())
            clipped = float(((gray <= 3) | (gray >= 252)).mean())
            resolution = min(10., min(image.size) / 64.)
            detail = min(10., max(0., np.log1p(sharpness) / np.log(1001) * 10.))
            exposure = max(0., 10. - clipped * 10.)
            technical = .4 * resolution + .4 * detail + .2 * exposure
            row.update(generalScore=round(general, 6), technicalScore=round(float(technical), 6),
                       sharpnessVariance=round(sharpness, 3), clippedPixelFraction=round(clipped, 6),
                       finalScore=round(.5 * row['animeScore'] + .3 * general + .2 * technical, 6))
        if (index + 1) % 40 == 0:
            print(f"General scoring {index+1}/{len(data['cards'])}", flush=True)
    data['generalModel'] = 'LAION-AI/aesthetic-predictor:ViT-B-32/openai'
    data['generalHeadSha256'] = hashlib.sha256(args.head.read_bytes()).hexdigest()
    data['weights'] = {'anime': .5, 'general': .3, 'technical': .2}
    source.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print('Saved combined scores', flush=True)


if __name__ == '__main__':
    main()
