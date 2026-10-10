from pathlib import Path
root = Path(__file__).resolve().parents[1]
static = root / 'src/main/resources/static'
p = static / 'test/engine.test.js'
s = p.read_text(encoding='utf-8').replace('    s.phase = "battle";', '    s.turn = 1;\n    s.phase = "battle";', 1)
s = s.replace('攻击表示变更后本回合不能再攻击', '上回合守备怪兽变更为攻击表示后可攻击')
start = s.index('    it("上回合守备怪兽')
end = s.index('    it(', start + 8)
block = s[start:end].replace('assert.equal(attacker.canAttack, false);', 'assert.equal(attacker.canAttack, true);').replace('assert.equal(e.attack(attacker, "player").success, false);', 'assert.equal(e.attack(attacker, "player").success, true);')
s = s[:start] + block + s[end:]
for title in ['手动发动只执行manual效果，不误执行其它触发时机', '本回合攻击封锁在目标下个回合开始时解除']:
    start = s.index(f'    it("{title}')
    end = s.find('    it(', start + 8)
    if end < 0: end = len(s)
    block = s[start:end].replace('s.currentPlayerIndex = 0;', 's.currentPlayerIndex = 0;\n        s.phase = "main_1";', 1)
    s = s[:start] + block + s[end:]
p.write_text(s, encoding='utf-8')
p = static / 'test/position-rule.test.js'
s = p.read_text(encoding='utf-8').replace('召唤后未攻击可以选择转为守备', '召唤当回合不能手动转为守备')
start = s.index('    it("召唤当回合')
end = s.index('    it(', start + 8)
block = s[start:end].replace('result.success, true', 'result.success, false').replace('monster.position, MONSTER_POSITION.DEFENSE', 'monster.position, MONSTER_POSITION.ATTACK').replace('monster.canAttack, false', 'monster.canAttack, true')
s = s[:start] + block + s[end:]
p.write_text(s, encoding='utf-8')
p = static / 'test/set-spell-rule.test.js'
s = p.read_text(encoding='utf-8').replace('盖放魔法不能在盖放当回合发动', '普通魔法可在盖放当回合发动')
s = s.replace('assert.equal(result.canActivate, false);', 'assert.equal(result.canActivate, true);', 1)
p.write_text(s, encoding='utf-8')
p = static / 'test/rarity-rules.test.js'
s = p.read_text(encoding='utf-8').replace('card.ruleSignature', '`${card.type}:${card.ruleSignature}`')
p.write_text(s, encoding='utf-8')

p = root / 'src/test/js/card-description-readability.test.js'
s = p.read_text(encoding='utf-8')
s = s.replace('角色卡固定三项技能，其他自动生成卡最多两个效果', '技能数量按稀有度分配，最高三项')
s = s.replace('const limit =', 'const limit =')
p.write_text(s, encoding='utf-8')
