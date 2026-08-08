ctrl_path = r"D:\Sekai_two\memory-11\Nightcord-Duel-Network-IDEA-v1.4.0-yugioh-rules\Nightcord-Duel-Network-v1.4.0\js\controller.js"
with open(ctrl_path, "r", encoding="utf-8") as f:
    lines = f.readlines()

count = 0
for i, line in enumerate(lines):
    if "const drawnCards = player.hand.splice(-drawCount)" in line:
        count += 1
        print(f"Occurrence {count} at line {i+1}:")
        for j in range(max(0,i-2), min(len(lines),i+4)):
            print(f"  {j+1}: {lines[j].rstrip()}")
        print()
