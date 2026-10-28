"""Reproducible local anime aesthetic scoring; no percentile or rarity quota."""
import argparse
import hashlib
import json
from pathlib import Path

import torch
import torchvision
from PIL import Image, ImageOps
from torchvision import transforms

ROOT = Path(__file__).resolve().parents[1]
STATIC = ROOT / "src/main/resources/static"
MODEL_REVISION = "5d732eb"


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--model", type=Path, required=True)
    parser.add_argument("--input", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    # Permit only the tensor/container/torchvision classes used by this published model.
    import collections
    allowed = [set, collections.OrderedDict]
    for module in [torch.nn, torchvision.models.convnext, torchvision.ops.misc, torchvision.ops.stochastic_depth]:
        if hasattr(module, "__dict__"):
            allowed.extend(value for value in vars(module).values() if isinstance(value, type))
    with torch.serialization.safe_globals(allowed):
        model = torch.load(args.model, map_location="cpu", weights_only=True)
    model.eval()
    torch.set_num_threads(4)
    transform = transforms.Compose([
        transforms.Resize((224, 224)), transforms.ToTensor(),
        transforms.Normalize([.485, .456, .406], [.229, .224, .225]),
    ])
    cards = json.loads(args.input.read_text(encoding="utf-8"))
    rows = []
    for index, card in enumerate(cards):
        source = card.get("originalImage") or card["image"]
        path = (STATIC / source.removeprefix("./")).resolve()
        if not path.is_relative_to(STATIC.resolve()) or not path.is_file():
            raise ValueError(f"Missing/invalid original art: {card['id']}: {source}")
        with Image.open(path) as opened:
            image = ImageOps.exif_transpose(opened).convert("RGB")
            with torch.inference_mode():
                score = float(model(transform(image).unsqueeze(0)).item())
            rows.append({"id": card["id"], "name": card["name"], "type": card["type"],
                         "oldRarity": card["rarity"], "image": source,
                         "width": image.width, "height": image.height,
                         "imageSha256": hashlib.sha256(path.read_bytes()).hexdigest(),
                         "animeScore": round(score, 6)})
        if (index + 1) % 20 == 0:
            print(f"Scored {index + 1}/{len(cards)}", flush=True)
    result = {"model": "Blackroot/Anime-Aesthetic-Predictor-Medium",
              "revision": MODEL_REVISION,
              "modelSha256": hashlib.sha256(args.model.read_bytes()).hexdigest(),
              "torch": torch.__version__, "torchvision": torchvision.__version__, "cards": rows}
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Saved {len(rows)} scores to {args.output}")


if __name__ == "__main__":
    main()
