# -*- coding: utf-8 -*-
"""
Sekai Duel — "SEKAI ARCHIVE" poster prompt system.

Turns the 368-card dataset into one experimental editorial-poster prompt per card.

The point: every prompt shares ONE identical art-direction chassis; only the derived
variables (subject, motifs, palette, material, text lockup) change. That is what makes
368 images read as a single visual system rather than 368 unrelated posters.
"""
import io
import json
import os
import re

HERE = os.path.dirname(os.path.abspath(__file__))
CARDS_JSON = r'D:\Sekai_two\memory-11\SekaiGameGodot\data\cards.json'
VISUAL_MAP = r'D:\Sekai_two\memory-11\SekaiGame\all-monster-visual-map.tsv'

# --------------------------------------------------------------------------
# 1. ACCENT COLOUR — tied to the card's attribute (its elemental allegiance)
# --------------------------------------------------------------------------
ATTR_ACCENT = {
    'light': ('ivory-white, cool paper-grey, pale bone', 'pale antique gold (#B79A5E)'),
    'dark':  ('charcoal, ash-grey, cold off-white',      'deep aubergine ink-violet (#4C3A5E)'),
    'water': ('slate grey-blue, cold paper-white',       'desaturated teal (#4E7C86)'),
    'fire':  ('warm grey, old-paper cream',              'muted brick vermilion (#A8482F)'),
    'wind':  ('pale cool grey, chalk white',             'celadon grey-green (#7A9082)'),
    'earth': ('sand-grey, old paper tan',                'ochre umber (#8A6A45)'),
    'none':  ('graphite, cold white, mid grey',          'slate blue-grey (#6E7480)'),
}

# --------------------------------------------------------------------------
# 2. STYLE MOTIFS — from the project's own visual map (122 cards).
#    Abstract design language, never literal symbols.
# --------------------------------------------------------------------------
STYLE_MOTIF = {
    'time-stop':        'concentric frozen time-rings with a phase offset; repeated afterimage silhouettes displaced by a few millimetres; a stopped clock-hand used as a construction line',
    'bomb':             'radial fragmentation diagram; a detonation shown only as an expanding module grid; pressure rings drawn as hairlines',
    'bullet':           'ballistic trajectory lines crossing the whole canvas; impact coordinates; a magnified inset of a single line of flight',
    'rose':             'petal forms sliced into flat planes; layered translucent overlays in register offset; thorn rhythm along a diagonal',
    'cream':            'soft viscous blob shapes converted into flat modular blocks; drip contours used as contour lines',
    'beast':            'claw-stroke vector marks; an animal contour reduced to one continuous line; pelt texture as coarse screen tone',
    'dimension':        'stacked misaligned rectangular portals; the figure cut and shifted across two incompatible frames; parallax offset between layers',
    'sunfire':          'solar flare arcs; a radial heat gradient rendered as halftone dots; a rising circular disc clipped by the frame edge',
    'serpent':          'a sinusoidal winding line traversing the layout; scale rhythm as repeating tick modules; an S-curve used as the compositional spine',
    'thunder':          'jagged zig-zag segmentation slicing the figure into offset plates; voltage potential drawn as a coordinate graph',
    'love-whip':        'long ribbon curves that become structural guides; soft rounded modules answering hard rectangular ones',
    'stone-chain':      'modular stone blocks with visible joints; a chain-link grid used as the master grid; weight expressed as dark mass in the lower third',
    'poison-butterfly': 'mirror-symmetric wing geometry; a toxic gradient expressed as a printed dot ramp; deliberate asymmetric scale between the two wings',
    'water-dragon':     'current bands flowing horizontally; a dragon contour abstracted into a single breaking wave; tide-line strata',
    'wind-blade':       'diagonal slashing strokes cutting the canvas; the figure interrupted by clean blade gaps; velocity shown as displaced hairlines',
    'blood-flame':      'dark red ink blot diffusing into paper fibre; flame contour reduced to flat stacked tongues',
    'mist':             'low-opacity fog layers at different depths; the subject dissolving at its edges into paper grain',
    'flame-tiger':      'tiger-stripe diagonal rhythm; heat distortion rendered as displaced scan lines',
    'sound-bomb':       'waveform spikes plus a burst radius; a score-notation staff used as structural line work',
    'compass':          'a geometric compass rose used as the master construction diagram; radiating bearing lines and degree ticks',
    'ice-lotus':        'crystalline lotus lattice; frozen petal plates in transparent overlay; cold facet shading',
    'blood-moon':       'a large circular disc plus dark staining bleeding from its edge; an eclipse ring as the composition anchor',
    'moon-blade':       'crescent arcs repeated at decreasing scale; a blade edge used as a hairline crossing the whole canvas',
    'domain':           'an architectural grid cage receding in perspective; the layout itself becomes an enclosed interior; modular panels as cells',
    'domain-slash':     'an architectural grid severed by one clean diagonal cut; the displacement between the two halves deliberately visible',
    'hollow-purple':    'a void circle opened as negative space; everything bends around the absent centre; edge-only rendering',
    'infinity':         'an infinite loop band; a Möbius strip flattened into print; recursion shown as nested frames',
    'flame-arrow':      'a vector arrow as the primary graphic axis; a heat gradient along its length; a magnified inset of the arrowhead',
    'digital-song':     'audio spectrum analyser bands; glitched scan lines; waveform data used as the layout grid; signal loss as broken line segments',
    'dark-song':        'a muted waveform flattened to near silence; thin ruled staves; the figure rendered as an unlit silhouette inside a lit system',
    'bass-wave':        'low-frequency wave bands; a single vibrating string across the full width; the string shadow doubling as a structural line',
    'flame':            'flat stacked flame tongues as graphic planes; a heat gradient in halftone',
    'water':            'horizontal tide strata; surface tension drawn as contour lines',
    'wind':             'flow-field curves bending around the cropped figure; velocity hairlines',
    'earth':            'stratified soil strata bands; a geological cross-section as the layout skeleton',
    'light':            'a luminous core rendered as pure paper white; light shown by what it erases',
    'dark':             'deep void masses; the subject emerging only where tone is removed',
}

# --------------------------------------------------------------------------
# 3. EFFECT MOTIFS — read the card's own rules text.
# --------------------------------------------------------------------------
EFFECT_MOTIFS = [
    (r'破坏|破壊|destroy',        'a fracture diagram: one plate broken along annotated seams'),
    (r'无效|無効|negat',          'nullification shown as a cancelled rectangle struck through by one hairline'),
    (r'抽|draw',                  'an index-card fan and a filing-tab rhythm'),
    (r'手牌|hand',                'a fanned document block at the margin, tabs aligned to the grid'),
    (r'墓地|graveyard',           'a descending archive stack; tomographic strata below the fold'),
    (r'卡组|牌组|deck',           'a stacked-edge module column; visible page edges as a barcode rhythm'),
    (r'特殊召唤|召唤|summon',      'a summoning schematic: circle, bearing ticks and a docking rectangle'),
    (r'除外|exile',               'a cut-out blank where content was; removal shown as an empty frame with registration marks'),
    (r'返回|回手|return',         'an arcing return path; a boomerang curve doubling as a construction line'),
    (r'融合|fusion',              'two plates overlapping into a third; the intersection printed as a solid block'),
    (r'回复|heal|LP',             'a restoration gradient; a wound closed by overprinted tone'),
    (r'生命值|支付',              'a calibrated gauge with a descending needle'),
    (r'解放|祭品|tribute',        'release shown as a module dissolving upward out of the frame'),
    (r'盖卡|盖牌|set',            'a face-down plate with a single corner lifted'),
    (r'封印|封锁|lock',           'a sealing lattice over a module; the grid locked in place'),
    (r'誓约|盟约|契约|羁绊',       'a contract seal: two concentric rings and a single signature rule'),
    (r'记忆|回忆|思念',           'memory strata; stacked translucent sheets with slight registration drift'),
    (r'梦|幻',                    'dream haze: soft gradients held under a strict grid'),
    (r'交换',                     'two modules exchanging position, a displacement arrow between them'),
    (r'复制',                     'duplicate plates slightly out of register'),
    (r'攻击',                     'an attack vector and an impact coordinate'),
    (r'守备|守備',                'a shield plane locking the lower module in place'),
    (r'场地|场地魔法',            'a field diagram: the whole layout becomes the activated arena'),
]

# --------------------------------------------------------------------------
# 4. NAME MOTIFS — for cards whose rules text carries no design language.
#    Ordered: first matches win.
# --------------------------------------------------------------------------
NAME_MOTIFS = [
    # --- scenery / place (the 結界 and gallery cycle) --------------------
    (r'神社|参道|花灯',        'torii-gate geometry reduced to pure rectangles and a lantern rhythm along the modular grid'),
    (r'湖畔|水鏡|水镜|镜',      'mirror-water symmetry: the whole composition doubled and reversed across a calm horizon line'),
    (r'桜|樱',                 'petal plates distributed by a strict grid, not scattered; blossom used as a repeat module'),
    (r'雪|嶺|嶽|岭',           'snowfield negative space; the subject surviving only as a few cold hairlines'),
    (r'翠林|林|草野|草',       'vertical vegetation strata as a ruled module system; chlorophyll tone kept almost grey'),
    (r'水车|清流|流|汐|涟',     'a water-wheel radial index rotating against a linear current band'),
    (r'古都|塔|小路|街|巷|檐',   'architectural vanishing lines and an alley cut as a narrow vertical slit through the layout'),
    (r'黄昏|夕|落晖|余晖',      'a low sun raking across the layout at a shallow angle; long shadow bars'),
    (r'紅葉|红叶',             'scattered leaf plates pinned to coordinate points'),
    (r'结界|結界',             'a boundary lattice drawn as tensioned hairlines enclosing a protected void'),
    (r'霧|雾',                 'depth fog with the grid receding into it'),
    (r'夜|月下',               'a night field held at minimum tone; the grid readable only as faint rulings'),
    # --- concept / emotion ----------------------------------------------
    (r'誓约|盟约|契约|羁绊|信约', 'two signature rules crossing like a contract seal; a binding knot flattened into print'),
    (r'婚姻|托付一生',          'two rings interlocked as the master construction geometry'),
    (r'思念|回忆|记忆|时光',     'memory strata: translucent sheets stacked with registration drift and a vanished top layer'),
    (r'青春|青涩|少年',         'an unfinished grid: some modules filled, some left as bare paper'),
    (r'恋爱|情愫|倾心|心契|心诺', 'two offset plates straining toward alignment but never quite meeting'),
    (r'恶作剧|戏语|嬉闹|戏',     'one deliberately displaced module breaking an otherwise strict grid'),
    (r'笑容|笑|温柔|和睦',       'a warm tonal field with a single soft-edged module'),
    (r'并肩|众伴|同旅|伙伴|偕行', 'parallel figures as repeated vertical modules sharing one baseline'),
    (r'乐曲|奏|音|歌|旋律|节拍',  'stave lines and a waveform spine crossing the whole width'),
    (r'舞|跃动|舞踏',           'a rotational sweep arc and motion-blur plates'),
    (r'宣言|开幕|觉醒|决意',     'a proclamation plate: one bold oversized rule and a stamped mark'),
    (r'双剑|双刀|刃|剑|劍|刀',    'two blade edges crossing at a shallow angle; both rendered as single hairlines'),
    (r'碎光|光',               'broken light: a fragmented tonal ramp rather than a glow'),
    (r'信|邀|邀约|相邀',         'a folded letter module, crease lines used as construction lines'),
    (r'守护|保护|援军|城壁',     'a defensive wall section in cutaway; the module arrangement interlocking like masonry'),
    # --- classic monsters (iconic silhouettes, abstracted) ---------------
    (r'白龙|白龍',             'a cold white mass pressed into the layout; whiteness used as negative space; a spinal ridge line'),
    (r'黑龙|黑龍|暗黑|漆黑',     'a black mass where structure is implied only by edge highlights'),
    (r'真红眼',                'one crimson eye magnified into a sliced circular inset, everything else in grey'),
    (r'蓝宝石|紫翠玉|碧|翡翠',   'a faceted gem plane: hard triangular facets as the module system'),
    (r'恶魔|惡魔|魔人|小恶魔',   'horn geometry and an asymmetric grin line, the dark mass low in the frame'),
    (r'召唤|召喚',             'a ritual summoning circle with bearing ticks and a docking rectangle'),
    (r'精灵|妖精|天使|圣女|神姬', 'wing planes in transparent overlay and a floating ring arc'),
    (r'剑士|劍士|骑士|騎士|斧|武者', 'a stance axis and a weapon edge crossing the full width as one hairline'),
    (r'岩石|巨兵|铠|鎧|城壁',    'quarried blocks with visible joints; the mass anchored to the lower third'),
    (r'鹰身|翼龙|侦察者|天空|翼', 'wing planes sliced by the frame; updraft hairlines and altitude ticks'),
    (r'僵尸|喪尸|丧尸',          'decay shown as tonal dropout; the figure half-erased back into the paper'),
    (r'虫',                    'segmented chitin plates as a repeating module system'),
    (r'机械|機械|机器|要塞|猎手', 'panel seams as the master grid; specular machined edges; bolt rhythm as ticks'),
    (r'狼|野兽|魔兽|牛魔|海狸|犬', 'an animal contour reduced to one continuous line; fur as a coarse dot screen'),
    (r'鱼|海蛇|海龙|水魔|海',     'layered horizontal water strata with the body dissolving into them'),
    (r'壶|罐',                  'a vessel sectioned in cutaway; its interior revealed as a stacked module system'),
    (r'龙|龍',                  'a dragon contour abstracted to a single continuous line doubling as a structural rule'),
    (r'巨人|巨',                'extreme scale contrast: a small human module against an oversized plate'),
    (r'审判|審判|裁决|断罪',      'a measuring scale and a plumb line as the sole vertical axis'),
    (r'黑洞|虚空|終焉|终焉',      'a void disc punched clean through the layout; everything else bent around it'),
    (r'地裂|裂|崩',              'the ground plane split by one clean diagonal fault line'),
    (r'火刑|火|炎',              'flat stacked flame planes; heat shown by displacing the grid'),
    (r'封剑|封劍|护封|封印',      'a blade locked inside a lattice of sealing hairlines'),
    (r'心变|心變|心',            'two overlapping plates swapping places; a displacement arrow'),
    (r'陷阱|落穴|夹击|干扰|干扰阵', 'a concealed mechanism at rest: one calm field plus a single trigger mark'),
    (r'反射|镜力|镜',            'a mirror plane reflecting the layout at one half, everything else matte'),
    (r'停战|协定|协定',          'two opposing modules frozen mid-contact with a neutral gap between them'),
    (r'施舍|强欲|欲',            'an inventory ledger: a ruled column of modules, one row accented'),
    (r'除魔|拆除|除去',          'a subtraction diagram: one module lifted out leaving a clean void'),
    (r'魔导|魔導|魔道士',        'a staff axis and a glyph ring used as the master construction geometry'),
    (r'灯|燈|lamp',             'a lantern module burning as the single accent point against a dark ruled field'),
    (r'治愈|治癒|神',            'a restorative tonal ramp closing a gap in the grid; the repair left visible'),
    (r'裁|布|缝|織',             'cloth cut on a strict bias grid; pattern pieces as flat modular plates'),
    (r'家|隅|旧|舊|檐',          'an interior cutaway: room geometry flattened into overlapping rectangular planes'),
    (r'可爱|可愛|萌',            'one incongruously soft rounded module set against an otherwise severe grid'),
    (r'风|風|晚风',             'flow-field curves bending the grid without breaking it'),
]

# --------------------------------------------------------------------------
# 5. RACE MOTIFS — structural fallback by creature class.
# --------------------------------------------------------------------------
RACE_MOTIFS = {
    'dragon':       'a dragon body reduced to one continuous contour doubling as a structural line; wing planes cut into modular plates; scale rhythm as repeating ticks',
    'spellcaster':  'a spell-circuit diagram and glyph ring used as construction geometry; robe planes flattened into colour fields',
    'warrior':      'armour plates broken into modular rectangles; a stance axis crossing the canvas; the weapon edge as one unbroken hairline',
    'beast':        'an animal contour abstracted to one continuous line; fur as a coarse dot screen; paw-print modules used as grid nodes',
    'beast-warrior':'a hybrid axis: animal contour crossing an armoured rectangular module',
    'fiend':        'horn geometry and an asymmetric grin line; the dark mass pressed into the lower third',
    'fairy':        'wing planes in transparent overlay; a floating ring arc used as the layout anchor',
    'psychic':      'interference moiré and displaced scan bands; thought shown as an expanding coordinate field',
    'machine':      'panel seams as the master grid; specular machined edges; bolt rhythm as tick marks',
    'zombie':       'decay shown as tonal dropout; the figure half-erased into the paper',
    'rock':         'a quarried cross-section as the layout skeleton; mineral speckle tone',
    'aqua':         'a water body as layered horizontal strata; one edge dissolving into paper',
    'pyro':         'flat stacked flame planes; heat shown by displacing the grid',
    'thunder':      'a voltage graph as the compositional spine; jagged segmentation plates',
    'insect':       'segmented chitin plates as a module system; fine mesh screen tone',
    'plant':        'a botanical plate: a leaf-vein skeleton used as line work',
    'reptile':      'scale rhythm as a repeating module; cold specimen sheen',
    'winged-beast': 'feather edges as a repeating rhythm; wing planes sliced by the frame',
    'sea-serpent':  'a winding body line traversing the full width; tide bands crossing it',
    'divine-beast': 'extreme tonal restraint; a gilded hairline system; mass expressed only as absence',
    'illusion':     'a ghosted double exposure; the figure present and absent at once',
    'creator-god':  'a generative diagram: the layout appears to be outputting itself',
}

# --------------------------------------------------------------------------
# 6. IDENTITY ANCHORS — recognisability that must survive decomposition.
# --------------------------------------------------------------------------
ANCHORS = [
    (r'龙|龍|dragon',        'a dragon skull-line and horn silhouette'),
    (r'魔导|魔導|魔道士',      'a tall pointed hat-arc or a staff line'),
    (r'剑|劍|刀|blade',       'a blade edge rendered as one unbroken hairline'),
    (r'枪|槍|spear|lance|筒',  'a barrel axis crossing the full width'),
    (r'弓|arrow|矢',          'a drawn bow arc and a straight shaft'),
    (r'眼|瞳',               'one eye rendered at high magnification as a sliced inset'),
    (r'猫|ネコ',             'feline ear triangles and a tail curve'),
    (r'女仆|メイド',          'a maid headdress arc and an apron plane'),
    (r'姬|姫|princess|女王|圣女', 'crown/frame geometry and a long hair mass'),
    (r'武|战士|戦士|warrior|骑士', 'a shoulder-armour plane and a stance axis'),
    (r'魔|术|術|法',          'a spell-circuit diagram and glyph-ring geometry'),
    (r'妖|仙|fairy|精灵|天使', 'wing planes and a floating halo arc'),
    (r'机|機械|machine|cyber', 'panel seams and a machined edge'),
    (r'鬼|fiend|demon|恶魔',   'horn geometry and an asymmetric grin line'),
    (r'海|波|浪|tide|湖',      'tide bands and salt-crust edge tone'),
    (r'雪|霜|冰|ice|frost|嶺', 'a frost crystal lattice and cold facet planes'),
    (r'花|樱|櫻|bloom|桜',     'petal plates in overlapping registration'),
    (r'月|moon',             'a lunar disc and a crescent arc'),
    (r'星|star|solar|空',      'a point-star geometry and an orbit ellipse'),
    (r'雨|rain',             'rain ruled lines and a wet-surface reflection band'),
    (r'琴|歌|音|song|music|奏|旋律', 'stave lines and a waveform spine'),
    (r'绘|画|絵|paint',       'brush-stroke planes and a canvas-weave ground'),
    (r'舞|dance',            'a rotational sweep arc and motion-blur plates'),
    (r'城|壁|要塞',            'masonry joints and a rampart module rhythm'),
    (r'尸|僵尸|喪',            'a torn tonal edge and a dropout silhouette'),
]

# --------------------------------------------------------------------------
# 7. MATERIAL — keyed to race, then series.
# --------------------------------------------------------------------------
RACE_MATERIAL = {
    'dragon':       'cold brushed metal, blueprint blue-line underlay, frost-grain paper',
    'spellcaster':  'aged paper fibre with ink diffusion, photocopier noise at the edges',
    'warrior':      'cold brushed steel sheen, industrial halftone screen',
    'beast':        'coarse paper grain, heavy copier noise, fur rendered as a dot screen',
    'beast-warrior':'coarse paper grain over a cold steel sheen',
    'fiend':        'xerox degradation, film scratches, toner smear in the darks',
    'fairy':        'glass transparency layers, pale haze, faint iridescent film',
    'psychic':      'data-glitch scan bands, moiré interference, chromatic print drift',
    'machine':      'machined aluminium, precision hatch lines, specular scratches',
    'zombie':       'damp stained stock, mottled rot texture, dust bloom',
    'rock':         'quarried stone cross-section, mineral speckle, chalk dust',
    'aqua':         'wet paper, salt bloom, condensation on glass',
    'pyro':         'scorched stock, charred edge, ash speckle',
    'thunder':      'electrostatic static-noise grain, ozone-burnt trace lines',
    'insect':       'chitin sheen, fine mesh screen tone, specimen-pin marks',
    'plant':        'pressed-herb paper, leaf-vein skeleton, botanical-archive stock',
    'reptile':      'cold scaled plate texture, museum specimen sheen',
    'winged-beast': 'feather-edge grain, dry pigment on textured stock',
    'sea-serpent':  'tide-stained paper, salt-encrusted edges',
    'divine-beast': 'gilded foil wear, embossed archive stock, extreme tonal restraint',
    'illusion':     'glass transfer, ghosted double exposure, film burns',
    'creator-god':  'fine drafting vellum, precise ink ruling, archival pencil underlay',
}
SERIES_MATERIAL = {
    'starter_ygo':    'museum specimen-archive stock, catalogue-card tan, punched index holes, blueprint linework',
    'source_archive': 'institutional record stock, xerox noise, correction-fluid patches, stamped restraint',
    'picture':        'old-paper grain, print registration drift, risograph misprint edges',
    'picture_ssr7':   'cold matte frost paper, fine moiré, metallic cold-light sheeting',
    'nightcord':      'cold frosted paper, low-light scan noise, faint monitor banding, a glass reflection layer',
}

# --------------------------------------------------------------------------
# 8. TREATMENT — monster vs spell vs trap read differently.
# --------------------------------------------------------------------------
TYPE_BASE_MOTIF = {
    'monster': 'a contour system: the figure dissected into flat plates and bare line work that share one grid',
    'spell':   'a ritual apparatus of translucent sheets, cut modules and a single reading rule',
    'trap':    'a withheld mechanism: one calm field holding a single precise trigger mark',
}

TYPE_TREATMENT = {
    'monster': {
        'subject': 'a deconstructed anime figure — {name}',
        'decomp': ('crop the figure at two or more frame edges; show a magnified facial or eye slice as an inset window; '
                   'offset a ghosted duplicate by a few millimetres; separate the line drawing from its colour block and '
                   'shift them apart; cut the silhouette with the grid so the background shows through the body; render '
                   'part of the body as pure flat plane and part as bare line art'),
        'fusion': ('extend the hair, clothing or weapon beyond the body as structural line work that continues into the layout grid; '
                   'let garment planes bleed out into the background colour fields; dissolve the lower body into paper grain'),
    },
    'spell': {
        'subject': 'no character as the subject — a conceptual ritual document generated by the card "{name}", with at most a '
                   'fragmentary figure dissolving into the layout as an echo',
        'decomp': ('treat the concept as an abstract apparatus: overlapping translucent sheets, a sliced module, a magnified '
                   'fragment inset, slit and displaced strips; at most one cropped human fragment (a hand, an eye slice, a '
                   'shoulder) partially printed through the structure'),
        'fusion': ('the apparatus and the ground are one printed surface: the diagram runs past the frame, tone fields pass '
                   'through the modules, and nothing sits on top of anything'),
    },
    'trap': {
        'subject': 'no character as the subject — a concealed mechanism document generated by the card "{name}", held in a state '
                   'of withheld tension, with at most a shadow fragment of a figure',
        'decomp': ('a face-down plate with one corner lifted; a spring-loaded geometric arm at rest; a large calm field '
                   'interrupted by one precise trigger mark; a magnified inset of the trigger'),
        'fusion': ('the withheld mechanism and the negative space are the same system: the release line runs out of the frame '
                   'and becomes the layout rule'),
    },
}

TEXT_RULE = ('Render EXACTLY the text strings below, verbatim and legible, as clean typographic lockups. '
             'No other words anywhere in the image. No fake glyphs, no counterfeit lettering, no gibberish, '
             'no watermark, no logo, no signature, no caption.')


def norm_race(race):
    return (race or '').lower().replace('_', '-')


def pick_side(card_id):
    """Deterministic left/right split so the archive does not look mechanically mirrored."""
    return 'RIGHT of frame' if (sum(ord(c) for c in card_id) % 2) else 'LEFT of frame'


def derive(card, style_map, cjk_title=True):
    cid = card['id']
    ctype = card.get('type', 'monster')
    attr = (card.get('attribute') or 'none').lower()
    rarity = card.get('rarity', 'N')
    series = card.get('series', '')
    race = norm_race(card.get('race'))
    desc = str(card.get('description') or '')
    name = card['name']

    # --- motifs: style -> name -> effects -> race -> attribute -----------
    # The card's own NAME carries its identity and beats generic rules boilerplate.
    motifs = []
    style = style_map.get(cid)
    if style and style in STYLE_MOTIF:
        motifs.append(STYLE_MOTIF[style])
    for pat, txt in NAME_MOTIFS:
        if len(motifs) >= 3:
            break
        if re.search(pat, name) and txt not in motifs:
            motifs.append(txt)
    # generic rules text only tops up; it never overrides the card's identity
    if ctype == 'monster' or len(motifs) < 2:
        for pat, txt in EFFECT_MOTIFS:
            if len(motifs) >= 4:
                break
            if re.search(pat, desc) and txt not in motifs:
                motifs.append(txt)
    if ctype == 'monster' and race in RACE_MOTIFS and len(motifs) < 4:
        motifs.append(RACE_MOTIFS[race])
    # guarantee at least two independent motif strands
    if len(motifs) < 2:
        motifs.append(STYLE_MOTIF.get(attr, STYLE_MOTIF['light']))
    if len(motifs) < 2:
        motifs.append(TYPE_BASE_MOTIF.get(ctype, TYPE_BASE_MOTIF['monster']))
    motifs = motifs[:4]

    # --- identity anchors -------------------------------------------------
    anchors = [txt for pat, txt in ANCHORS if re.search(pat, name)]
    if ctype == 'monster' and race in RACE_MOTIFS:
        anchors.append(RACE_MOTIFS[race].split(';')[0])
    if not anchors:
        anchors = [STYLE_MOTIF.get(attr, STYLE_MOTIF['light']).split(';')[0]]
    anchors = anchors[:3]

    base, accent = ATTR_ACCENT.get(attr, ATTR_ACCENT['none'])
    material = RACE_MATERIAL.get(race) or SERIES_MATERIAL.get(series) or \
        'cold matte paper, fine print grain, restrained archive stock'

    # --- text lockup ------------------------------------------------------
    code = cid.upper().replace('-', '_')
    tier = '%s / %s / %s' % (rarity, ctype.upper(), attr.upper())
    if ctype == 'monster':
        spec = 'LV %02d  ATK %04d  DEF %04d' % (card.get('level', 0), card.get('attack', 0), card.get('defense', 0))
    else:
        spec = 'ARCHIVE RECORD — TYPE %s' % ctype.upper()
    lines = (['TITLE: %s' % name] if cjk_title else []) + [
        'ARCHIVE No. %s' % code,
        'CLASS %s' % tier,
        'DATA %s' % spec,
        'SERIES SEKAI ARCHIVE / 368',
    ]
    text_block = '\n'.join('  - "%s"' % ln for ln in lines)

    t = TYPE_TREATMENT.get(ctype, TYPE_TREATMENT['monster'])
    return {
        'id': cid, 'name': name, 'rarity': rarity, 'type': ctype, 'attribute': attr,
        'series': series, 'race': race, 'motifs': motifs, 'anchors': anchors,
        'accent': accent, 'base': base, 'material': material,
        'style_token': style or '', 'side': pick_side(cid),
        'subject': t['subject'].format(name=name),
        'decomp': t['decomp'], 'fusion': t['fusion'], 'text_block': text_block,
    }


def build_prompt(d):
    return f"""EXPERIMENTAL ANIME CHARACTER EDITORIAL POSTER — 16:9 ULTRA-WIDE LANDSCAPE.
Part of a unified 368-piece visual archive titled "SEKAI ARCHIVE".

ART DIRECTION
Avant-garde editorial design. Modernist graphic design, structuralism, constructivism,
experimental art magazine, art-exhibition key visual, concept-design archive sheet.
Cool, restrained, conceptual, experimental, strongly structural, high art direction.
This is NOT a commercial anime promotional image.

SUBJECT
The subject is {d['subject']}.

DECOMPOSITION MANDATE
Do NOT render an ordinary complete full-body character illustration.
Do NOT stand the character in front of a decorative background.
Treat the figure as raw material for the layout: {d['decomp']}.
It may appear incomplete, cropped, transparent, repeated, fragmented or partially erased.
Recognisability must survive through: {'; '.join(d['anchors'])}.

VISUAL MOTIFS — abstract design language derived from the subject. Never literal symbols.
""" + '\n'.join('  {}. {}'.format(i + 1, m) for i, m in enumerate(d['motifs'])) + f"""

FIGURE / GROUND FUSION
{d['fusion']}.
There must be no separation between figure and ground — they are one printed system,
sharing the same grid, the same tone, the same paper.

LAYOUT
16:9 wide format. Asymmetric composition, generous negative space. The figure sits
{d['side']} — never centred, never in a normal poster pose. Build a clear horizontal
visual flow across the frame. Use: a non-symmetrical modular grid, hairline frames,
coordinate points, tick marks, a proportional scale bar, module rectangles, diagonal
construction lines, transparent overlays, collage edges cut by the frame,
one magnified inset window, and an archive data block.

COLOUR
Restrained, desaturated, high-end. Base: {d['base']}.
One accent only: {d['accent']}. The accent touches ONLY the key nodes — part of the
figure, the eye, an ability trace, one graphic module, the archive numbering, a
hairline, or the title mark. No cheap neon, no large saturated fields, no glow bloom.

MATERIAL / TEXTURE
{d['material']}.

TEXT
{TEXT_RULE}
{'-' * 60}
{d['text_block']}
{'-' * 60}

NEGATIVE
No ordinary anime poster. No complete full-body standing illustration. No figure placed
in front of a background. No figure/ground separation. No light-novel cover feel.
No moe commercial poster. No idol promotional image. No generic cyberpunk background.
No templated geometric ornament. No pile-up of symbols. No over-literal character
features. No cheap neon. No excessive glow. No over-complicated visual chaos.
No photorealistic human. No 3D photorealistic render. No watermark. No extra logo.
No garbled text. No low quality. No deformed limbs. No broken facial features.
"""


def main():
    cards = json.load(io.open(CARDS_JSON, encoding='utf-8-sig'))

    style_map = {}
    if os.path.exists(VISUAL_MAP):
        for line in io.open(VISUAL_MAP, encoding='utf-8'):
            parts = line.rstrip('\n').split('\t')
            if len(parts) >= 6:
                style_map[parts[0]] = parts[5]

    outdir = os.path.join(HERE, 'prompts')
    os.makedirs(outdir, exist_ok=True)

    manifest = []
    for c in cards:
        d = derive(c, style_map)
        prompt = build_prompt(d)
        io.open(os.path.join(outdir, d['id'] + '.txt'), 'w', encoding='utf-8').write(prompt)
        rec = dict(d)
        rec['prompt'] = prompt
        manifest.append(rec)

    json.dump(manifest, io.open(os.path.join(HERE, 'manifest.json'), 'w', encoding='utf-8'),
              ensure_ascii=False, indent=1)

    import collections
    print('cards            :', len(manifest))
    print('with style token :', sum(1 for r in manifest if r['style_token']))
    print('motif-count dist :', dict(collections.Counter(len(r['motifs']) for r in manifest)))
    print('single-motif left:', sum(1 for r in manifest if len(r['motifs']) == 1))
    print('wrote prompts to :', outdir)


if __name__ == '__main__':
    main()
