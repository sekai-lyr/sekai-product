// Battle reports contain only copied public values, never live card/player references.
export function battleSnapshot(state, attacker, target) {
    return {
        turn: state.turn, phase: state.phase, owner: state.currentPlayerIndex,
        players: state.players.map(player => ({ name: player.name, lp: player.lp })),
        attacker: { name: attacker?.name || "攻击者", attack: Number(attacker?.currentAttack) || 0 },
        target: target === "player" ? null : {
            name: target?.faceUp ? target.name : "盖放怪兽",
            faceUp: !!target?.faceUp,
            position: target?.position,
            power: target?.faceUp ? Number(target.position === "defense" ? target.currentDefense : target.currentAttack) || 0 : null,
        },
    };
}

export function battleReport(state, before, attacker, target, result) {
    const location = (card, owner) => {
        const player = state.players[owner];
        for (const [zone, label] of [["monsterZone", "场上"], ["graveyard", "墓地"], ["hand", "手牌"], ["banished", "除外区"], ["deck", "卡组"]]) {
            if (player[zone]?.includes(card)) return label;
        }
        return "已离场";
    };
    const lines = [`宣言时：${before.attacker.name} · ATK ${before.attacker.attack}`];
    if (!before.target) lines.push("目标：对方玩家（直接攻击）");
    else if (before.target.faceUp) lines.push(`宣言时目标：${before.target.name} · ${before.target.position === "defense" ? "DEF" : "ATK"} ${before.target.power}`);
    else lines.push("宣言时目标：盖放怪兽（数值未公开）");
    if (result.trapCard) lines.push(`陷阱响应：${result.trapCard.name}`);
    lines.push(result.attackCanceled ? "攻击已被取消，不进行本次战斗伤害计算" : `本次战斗伤害：${Number(result.damage) || 0}${result.damageTo ? `（${result.damageTo === "attacker" ? "攻击方" : "防守方"}承受）` : ""}`);
    before.players.forEach((player, i) => lines.push(`${player.name} LP：${player.lp} → ${state.players[i].lp}（含本次触发效果）`));
    lines.push(`${before.attacker.name}结算后：${location(attacker, before.owner)}`);
    if (before.target) lines.push(`${before.target.faceUp || target?.faceUp ? target.name : "盖放怪兽"}结算后：${location(target, 1 - before.owner)}`);
    return { turn: before.turn, phase: before.phase, lines };
}
