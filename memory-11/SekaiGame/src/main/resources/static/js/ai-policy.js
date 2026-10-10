// Scoring sees public information only. Unknown cards have a fixed risk estimate,
// never their printed stats, effects, identity or order in the deck.
export function publicCard(card) {
    if (card.faceDown || card.faceUp === false) return {
        instanceId: card.instanceId, faceUp: false, faceDown: true,
        position: 'defense', currentAttack: 0, currentDefense: 1500, effects: [],
    };
    return card;
}
export function publicOpponent(player) {
    return { lp: player.lp, monsterZone: player.monsterZone.map(publicCard),
        spellTrapZone: player.spellTrapZone.map(publicCard), graveyard: player.graveyard,
        banished: player.banished, hand: Array(player.hand.length).fill(null),
        deck: Array(player.deck.length).fill(null) };
}
export function materialValue(card) {
    return Math.max(card.currentAttack || 0, (card.currentDefense || 0) * .65)
        + (card.effects?.length || 0) * 220 + (card.themedState?.charges || 0) * 450
        + (card.effects?.some(e => ['ensemble', 'chorus', 'ignite', 'combust'].includes(e.action)) ? 350 : 0);
}
export function legalMaterials(player) {
    return player.monsterZone.filter(card => !card.cannotUseAsMaterial && !(card.themedState?.statuses?.curse > 0))
        .sort((a, b) => materialValue(a) - materialValue(b));
}
export function attackReady(card, state) {
    return card.faceUp && card.position === 'attack' && card.canAttack && !card.cannotAttack
        && !(card.themedState?.frozenUntil >= state.turn) && !(card.themedState?.paralyzedUntil >= state.turn);
}
