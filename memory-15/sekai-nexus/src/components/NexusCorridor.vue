<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import * as THREE from 'three'
import { gsap } from 'gsap'

const props = defineProps<{ language: '中文' | 'EN' }>()

type MapId = 'town' | 'trail' | 'grove'
type BattleResult = 'captured' | 'defeated' | 'lost' | 'escaped' | null

type CreatureData = {
  id: string
  name: string
  englishName: string
  description: string
  element: string
  level: number
  maxHp: number
  attack: number
  color: number
  accent: number
  wild: boolean
  spawn?: { map: MapId; position: [number, number] }
}

type NpcData = {
  id: string
  name: string
  role: string
  dialog: string
  map: MapId
  position: [number, number]
  color: number
}

type BattleState = {
  enemy: CreatureData
  enemyHp: number
  playerHp: number
  playerMaxHp: number
  message: string
  result: BattleResult
  captureAttempts: number
  busy: boolean
}

type Transition = {
  from: MapId
  to: MapId
  position: [number, number]
  entry: [number, number]
  label: string
}

const maps: Array<{ id: MapId; name: string; englishName: string; description: string }> = [
  { id: 'town', name: '晨露镇', englishName: 'Dewdrop Town', description: '旅人补给、交流和保存冒险记录的小镇。' },
  { id: 'trail', name: '风铃野路', englishName: 'Bellwind Trail', description: '穿过草坡和湖岸的第一条野外路线。' },
  { id: 'grove', name: '苔光林地', englishName: 'Mossglow Grove', description: '晶体和古树共生的深处林地。' },
]

const creatures: CreatureData[] = [
  { id: 'spriglet', name: '芽芽兽', englishName: 'Spriglet', description: '会把清晨露水点成小灯的森林幼兽。', element: '荧光 / 草地', level: 5, maxHp: 42, attack: 10, color: 0xe89471, accent: 0xffefbd, wild: false },
  { id: 'cloud-tail', name: '云尾兽', englishName: 'Mistral Pup', description: '住在风铃树冠之间，尾巴会留下淡淡的云。', element: '风 / 晴空', level: 6, maxHp: 32, attack: 8, color: 0x7bc4d2, accent: 0xd7f4e8, wild: true, spawn: { map: 'trail', position: [5.2, -8] } },
  { id: 'tide-ear', name: '潮耳兽', englishName: 'Tidekin', description: '在湖岸寻找会发光的贝壳，喜欢跟着旅人散步。', element: '水 / 湖岸', level: 7, maxHp: 38, attack: 9, color: 0x6ca8db, accent: 0xffe2a4, wild: true, spawn: { map: 'trail', position: [8.5, -20] } },
  { id: 'ember-mole', name: '栗角兽', englishName: 'Cinderhorn', description: '额角藏着温暖火种，黄昏时最容易遇见它。', element: '火 / 黄昏', level: 9, maxHp: 46, attack: 12, color: 0xd47c5f, accent: 0xffd17e, wild: true, spawn: { map: 'trail', position: [-8.7, -16] } },
  { id: 'stone-sprout', name: '岩芽兽', englishName: 'Mossback', description: '背上的晶石会吸收阳光，性格安静而可靠。', element: '岩 / 晶石', level: 11, maxHp: 54, attack: 13, color: 0x9c86ca, accent: 0xf1d5ae, wild: true, spawn: { map: 'grove', position: [-4.4, -10] } },
  { id: 'star-shell', name: '星壳兽', englishName: 'Aster Shell', description: '会在夜里展开星纹外壳，为迷路者指引方向。', element: '星 / 夜光', level: 13, maxHp: 62, attack: 15, color: 0x687ec2, accent: 0xd4e2ff, wild: true, spawn: { map: 'grove', position: [7.9, -19] } },
]

const npcs: NpcData[] = [
  { id: 'mira', name: '米拉', role: '镇长', dialog: '从这里出发吧。记得在镇中心的星灯旁保存进度。', map: 'town', position: [-6, -5], color: 0xe48f70 },
  { id: 'orin', name: '奥林', role: '补给师', dialog: '野外生物怕生，先削弱体力，再使用捕捉晶球会更容易。', map: 'town', position: [6, -5], color: 0x719dc3 },
  { id: 'sora', name: '索拉', role: '路线训练师', dialog: '这条路尽头是苔光林地。你的伙伴会在每场战斗后获得经验。', map: 'trail', position: [7, 3], color: 0xc19adf },
]

const transitions: Transition[] = [
  { from: 'town', to: 'trail', position: [0, -24], entry: [0, 9], label: '前往风铃野路' },
  { from: 'trail', to: 'town', position: [0, 13], entry: [0, -20], label: '返回晨露镇' },
  { from: 'trail', to: 'grove', position: [11, -23], entry: [-10, 9], label: '进入苔光林地' },
  { from: 'grove', to: 'trail', position: [-10, 10], entry: [10, -20], label: '回到风铃野路' },
]

const copy = computed(() => props.language === 'EN' ? {
  worldLabel: 'SEKAI WILDS / VERTICAL SLICE',
  title: 'Wild Isles',
  subtitle: 'A small world, ready to be explored.',
  intro: 'Leave the town, meet a wild companion, then bring your story home to the save shrine.',
  mapLabel: 'Map',
  trainer: 'Trail trainer',
  level: 'Lv.',
  exp: 'EXP',
  guide: 'Field guide',
  nearby: 'Nearby creature',
  talk: 'Talk',
  battle: 'Battle',
  startBattle: 'Start trainer battle',
  noCreature: 'Walk out of town to find a wild companion.',
  save: 'Save progress',
  saveHint: 'Stand beside the star-lamp in town.',
  saved: 'Progress saved',
  movement: 'WASD / arrows move',
  camera: 'Drag to look · wheel to zoom',
  touch: 'Touch the pad to move',
  caught: 'Caught',
  defeated: 'Defeated',
  battleTitle: 'Wild encounter',
  yourPartner: 'Your partner',
  attack: 'Attack',
  capture: 'Capture orb',
  run: 'Run away',
  backToWorld: 'Return to world',
  captureHint: 'Weaken the wild creature before throwing the orb.',
  battleWin: 'The encounter is complete. Experience gained.',
  battleLoss: 'Your partner needs a rest. Return to town when ready.',
  npcLabel: 'Resident',
  bestiary: '6 original species',
} : {
  worldLabel: 'SEKAI WILDS / 第一阶段可玩切片',
  title: '星岛奇境',
  subtitle: '一座可以真正开始探索的小世界。',
  intro: '离开小镇，遇见野外伙伴，再把这段冒险带回星灯存档。',
  mapLabel: '地图',
  trainer: '路线训练师',
  level: '等级',
  exp: '经验',
  guide: '生物图鉴',
  nearby: '附近生物',
  talk: '对话',
  battle: '战斗',
  startBattle: '发起训练师战斗',
  noCreature: '走出小镇，去野外寻找伙伴。',
  save: '保存进度',
  saveHint: '站在小镇中央的星灯旁保存。',
  saved: '进度已保存',
  movement: 'WASD / 方向键移动',
  camera: '拖动观察 · 滚轮缩放',
  touch: '触控方向盘移动',
  caught: '已捕捉',
  defeated: '已击败',
  battleTitle: '野外遭遇',
  yourPartner: '你的伙伴',
  attack: '攻击',
  capture: '投掷捕捉晶球',
  run: '离开战斗',
  backToWorld: '返回世界',
  captureHint: '先削弱野外生物，再投掷捕捉晶球。',
  battleWin: '遭遇结束，已经获得经验。',
  battleLoss: '伙伴需要休息，准备好后返回小镇。',
  npcLabel: '居民',
  bestiary: '6 种原创生物',
})

const stageRef = ref<HTMLElement | null>(null)
const canvasRef = ref<HTMLCanvasElement | null>(null)
const mapFadeRef = ref<HTMLElement | null>(null)
const battleFlashRef = ref<HTMLElement | null>(null)
const mapId = ref<MapId>('town')
const selectedCreature = ref<CreatureData | null>(null)
const selectedNpc = ref<NpcData | null>(null)
const battle = ref<BattleState | null>(null)
const viewMode = ref<'world' | 'battle'>('world')
const playerXp = ref(0)
const playerLevel = ref(1)
const caughtIds = ref<string[]>([])
const defeatedIds = ref<string[]>([])
const battleWins = ref(0)
const notice = ref('')
const saveMessage = ref('')
const saveAvailable = ref(false)
const isMobile = ref(false)
const reducedMotion = ref(false)
const playerPosition = ref({ x: 0, z: 8 })

const currentMap = computed(() => maps.find((map) => map.id === mapId.value) ?? maps[0])
const activeCreature = computed(() => creatures[0])
const expToNext = computed(() => playerLevel.value * 30)
const expProgress = computed(() => Math.min(100, (playerXp.value / expToNext.value) * 100))
const caughtCount = computed(() => caughtIds.value.length)
const selectedStatus = computed(() => {
  if (!selectedCreature.value) return ''
  if (caughtIds.value.includes(selectedCreature.value.id)) return copy.value.caught
  if (defeatedIds.value.includes(selectedCreature.value.id)) return copy.value.defeated
  return ''
})

let renderer: THREE.WebGLRenderer | null = null
let scene: THREE.Scene | null = null
let camera: THREE.PerspectiveCamera | null = null
let mapRoot: THREE.Group | null = null
let playerGroup: THREE.Group | null = null
let cloudGroup: THREE.Group | null = null
let savePoint: THREE.Object3D | null = null
let ambientClock = new THREE.Clock()
let animationFrame = 0
let resizeTimer: number | undefined
let motionQuery: MediaQueryList | null = null
let mobileQuery: MediaQueryList | null = null
let cameraYaw = 0
let cameraHeight = 4.4
let cameraDistance = 8
let pointerStart: { x: number; y: number } | null = null
let pointerMoved = false
let lastPointer = { x: 0, y: 0 }
let playerWalkPhase = 0
let glowTexture: THREE.CanvasTexture | null = null
let destinationMarker: THREE.Mesh | null = null
let transitionBusy = false
let battleTimer: number | undefined

const keys = new Set<string>()
const touchFlags = { up: false, down: false, left: false, right: false }
const raycaster = new THREE.Raycaster()
const pointer = new THREE.Vector2()
const creatureVisuals = new Map<string, { group: THREE.Group; ring: THREE.Mesh; phase: number }>()
const npcVisuals = new Map<string, THREE.Group>()
const STORAGE_KEY = 'sekai-wilds-phase-one-save'

function getGlowTexture() {
  if (glowTexture) return glowTexture
  const canvas = document.createElement('canvas')
  canvas.width = 128
  canvas.height = 128
  const context = canvas.getContext('2d')
  if (context) {
    const gradient = context.createRadialGradient(64, 64, 0, 64, 64, 64)
    gradient.addColorStop(0, 'rgba(255, 239, 181, .92)')
    gradient.addColorStop(.3, 'rgba(255, 196, 111, .34)')
    gradient.addColorStop(1, 'rgba(255, 196, 111, 0)')
    context.fillStyle = gradient
    context.fillRect(0, 0, 128, 128)
  }
  glowTexture = new THREE.CanvasTexture(canvas)
  glowTexture.colorSpace = THREE.SRGBColorSpace
  return glowTexture
}

function addMesh(parent: THREE.Object3D, geometry: THREE.BufferGeometry, material: THREE.Material, position: [number, number, number], scale?: [number, number, number]) {
  const mesh = new THREE.Mesh(geometry, material)
  mesh.position.set(...position)
  if (scale) mesh.scale.set(...scale)
  parent.add(mesh)
  return mesh
}

function markInteractive(object: THREE.Object3D, key: string, value: string) {
  object.userData[key] = value
  object.traverse((child) => { child.userData[key] = value })
}

function addTree(parent: THREE.Group, x: number, z: number, scale = 1, leafColor = 0x4e9568) {
  const tree = new THREE.Group()
  tree.position.set(x, 0, z)
  tree.scale.setScalar(scale)
  addMesh(tree, new THREE.CylinderGeometry(.16, .25, 1.8, 7), new THREE.MeshStandardMaterial({ color: 0x805b3d, roughness: .96 }), [0, .8, 0])
  addMesh(tree, new THREE.ConeGeometry(1.18, 2.8, 8), new THREE.MeshStandardMaterial({ color: leafColor, roughness: .92 }), [0, 2.15, 0])
  addMesh(tree, new THREE.IcosahedronGeometry(.86, 1), new THREE.MeshStandardMaterial({ color: new THREE.Color(leafColor).offsetHSL(.01, .02, .08), roughness: .9 }), [.08, 3.15, .02])
  parent.add(tree)
}

function addCrystal(parent: THREE.Group, x: number, z: number, color: number, scale = 1) {
  const crystal = new THREE.Group()
  crystal.position.set(x, .05, z)
  crystal.scale.setScalar(scale)
  const material = new THREE.MeshStandardMaterial({ color, roughness: .22, metalness: .12, emissive: color, emissiveIntensity: .5, transparent: true, opacity: .88 })
  addMesh(crystal, new THREE.OctahedronGeometry(.62, 0), material, [0, .55, 0], [.72, 1.8, .72])
  addMesh(crystal, new THREE.OctahedronGeometry(.32, 0), material, [.52, .42, .18], [.72, 1.5, .72])
  parent.add(crystal)
  const light = new THREE.PointLight(color, .5, 5, 2)
  light.position.set(x, 1, z)
  parent.add(light)
}

function addHill(parent: THREE.Group, x: number, z: number, scale: number, color = 0x6e9d85) {
  addMesh(parent, new THREE.ConeGeometry(5.6, 9, 7), new THREE.MeshStandardMaterial({ color, roughness: 1 }), [x, 3.7, z], [scale, scale, scale])
}

function addHouse(parent: THREE.Group, x: number, z: number, scale = 1, roofColor = 0x5e7f96) {
  const house = new THREE.Group()
  house.position.set(x, 0, z)
  house.scale.setScalar(scale)
  const wall = new THREE.MeshStandardMaterial({ color: 0xe6d1a7, roughness: .88 })
  const roof = new THREE.MeshStandardMaterial({ color: roofColor, roughness: .78 })
  addMesh(house, new THREE.BoxGeometry(3.6, 2.7, 3), wall, [0, 1.35, 0])
  addMesh(house, new THREE.ConeGeometry(2.8, 2.1, 4), roof, [0, 3.75, 0], [1, 1, 1.08])
  addMesh(house, new THREE.PlaneGeometry(.65, 1.15), new THREE.MeshBasicMaterial({ color: 0xffd488, transparent: true, opacity: .88 }), [0, .72, -1.53])
  addMesh(house, new THREE.PlaneGeometry(.62, .55), new THREE.MeshBasicMaterial({ color: 0x93d7d4, transparent: true, opacity: .82 }), [-1.03, 1.55, -1.54])
  addMesh(house, new THREE.PlaneGeometry(.62, .55), new THREE.MeshBasicMaterial({ color: 0x93d7d4, transparent: true, opacity: .82 }), [1.03, 1.55, -1.54])
  parent.add(house)
}

function createNameSprite(text: string, color = '#fff4cc') {
  const canvas = document.createElement('canvas')
  canvas.width = 360
  canvas.height = 82
  const context = canvas.getContext('2d')
  if (context) {
    context.fillStyle = 'rgba(22, 55, 61, .78)'
    context.roundRect(4, 4, 352, 74, 18)
    context.fill()
    context.fillStyle = color
    context.font = '600 24px "Segoe UI", sans-serif'
    context.textAlign = 'center'
    context.fillText(text, 180, 49)
  }
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false, opacity: .82 }))
  sprite.scale.set(2.45, .56, 1)
  return sprite
}

function createCreature(data: CreatureData) {
  if (!mapRoot || !data.spawn || data.spawn.map !== mapId.value) return
  const group = new THREE.Group()
  group.position.set(data.spawn.position[0], 0, data.spawn.position[1])
  group.scale.setScalar(.92)
  group.userData.creatureId = data.id
  const bodyMaterial = new THREE.MeshStandardMaterial({ color: data.color, roughness: .72, emissive: data.color, emissiveIntensity: .08 })
  const accentMaterial = new THREE.MeshStandardMaterial({ color: data.accent, roughness: .64 })
  const eyeMaterial = new THREE.MeshBasicMaterial({ color: 0x263b4a })
  addMesh(group, new THREE.SphereGeometry(.75, 14, 10), bodyMaterial, [0, .78, 0], [.98, .74, .95])
  addMesh(group, new THREE.SphereGeometry(.58, 14, 10), bodyMaterial, [0, 1.48, .04])
  addMesh(group, new THREE.SphereGeometry(.42, 12, 8), accentMaterial, [0, .76, .57], [.86, 1.08, .36])
  const leftEar = addMesh(group, new THREE.ConeGeometry(.2, .68, 5), bodyMaterial, [-.36, 2.02, .02])
  const rightEar = addMesh(group, new THREE.ConeGeometry(.2, .68, 5), bodyMaterial, [.36, 2.02, .02])
  leftEar.rotation.z = -.24
  rightEar.rotation.z = .24
  addMesh(group, new THREE.SphereGeometry(.075, 8, 6), eyeMaterial, [-.2, 1.5, .51])
  addMesh(group, new THREE.SphereGeometry(.075, 8, 6), eyeMaterial, [.2, 1.5, .51])
  const tail = addMesh(group, new THREE.TorusGeometry(.42, .12, 7, 14, Math.PI * 1.2), bodyMaterial, [.58, .72, -.18])
  tail.rotation.y = Math.PI / 2
  tail.rotation.z = -.35
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1.08, .035, 8, 36), new THREE.MeshBasicMaterial({ color: 0xffdf9d, transparent: true, opacity: .08 }))
  ring.rotation.x = -Math.PI / 2
  ring.position.y = .04
  group.add(ring)
  group.add(createNameSprite(data.name))
  const unavailable = caughtIds.value.includes(data.id) || defeatedIds.value.includes(data.id)
  group.visible = !unavailable
  markInteractive(group, 'creatureId', data.id)
  mapRoot.add(group)
  creatureVisuals.set(data.id, { group, ring, phase: data.spawn.position[0] * .31 + data.spawn.position[1] * .07 })
}

function createNpc(data: NpcData) {
  if (!mapRoot || data.map !== mapId.value) return
  const group = new THREE.Group()
  group.position.set(data.position[0], 0, data.position[1])
  const body = new THREE.MeshStandardMaterial({ color: data.color, roughness: .78 })
  const skin = new THREE.MeshStandardMaterial({ color: 0xf0c09f, roughness: .8 })
  const dark = new THREE.MeshStandardMaterial({ color: 0x493a5e, roughness: .86 })
  addMesh(group, new THREE.CylinderGeometry(.43, .58, 1.3, 8), body, [0, 1.1, 0])
  addMesh(group, new THREE.SphereGeometry(.46, 12, 10), skin, [0, 2, 0])
  addMesh(group, new THREE.SphereGeometry(.5, 12, 8), dark, [0, 2.28, -.02], [1.04, .5, 1.04])
  addMesh(group, new THREE.CylinderGeometry(.13, .15, .7, 7), dark, [-.24, .34, 0])
  addMesh(group, new THREE.CylinderGeometry(.13, .15, .7, 7), dark, [.24, .34, 0])
  group.add(createNameSprite(data.name, '#d8f4e5'))
  markInteractive(group, 'npcId', data.id)
  mapRoot.add(group)
  npcVisuals.set(data.id, group)
}

function addMapMarker(parent: THREE.Group, position: [number, number, number], color: number) {
  const marker = new THREE.Group()
  marker.position.set(...position)
  addMesh(marker, new THREE.CylinderGeometry(.13, .22, 2.2, 8), new THREE.MeshStandardMaterial({ color: 0xf0d6a0, roughness: .65, emissive: color, emissiveIntensity: .2 }), [0, 1.1, 0])
  const orb = addMesh(marker, new THREE.SphereGeometry(.34, 12, 8), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: .88 }), [0, 2.4, 0])
  marker.add(new THREE.PointLight(color, 1.4, 7, 2))
  const halo = new THREE.Mesh(new THREE.TorusGeometry(.62, .04, 8, 28), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: .65 }))
  halo.rotation.x = -Math.PI / 2
  halo.position.y = .08
  marker.add(halo)
  marker.userData.orb = orb
  parent.add(marker)
}

function createSavePoint(parent: THREE.Group) {
  const shrine = new THREE.Group()
  shrine.position.set(0, 0, -4)
  addMesh(shrine, new THREE.CylinderGeometry(1.2, 1.45, .25, 10), new THREE.MeshStandardMaterial({ color: 0xe4c991, roughness: .8 }), [0, .12, 0])
  addMesh(shrine, new THREE.CylinderGeometry(.56, .68, 1.65, 8), new THREE.MeshStandardMaterial({ color: 0x6c8f90, roughness: .5, emissive: 0x3b7775, emissiveIntensity: .32 }), [0, 1, 0])
  addMesh(shrine, new THREE.SphereGeometry(.38, 12, 8), new THREE.MeshBasicMaterial({ color: 0xffdb91, transparent: true, opacity: .95 }), [0, 2.1, 0])
  shrine.add(new THREE.PointLight(0xffca78, 3.5, 12, 2))
  shrine.add(createNameSprite('星灯存档点', '#ffe3a4'))
  parent.add(shrine)
  savePoint = shrine
}

function createMap() {
  if (!scene) return
  if (mapRoot) disposeMap()
  mapRoot = new THREE.Group()
  scene.add(mapRoot)
  creatureVisuals.clear()
  npcVisuals.clear()
  selectedNpc.value = null
  selectedCreature.value = null

  const mapGround = new THREE.MeshStandardMaterial({ color: mapId.value === 'town' ? 0x639b69 : mapId.value === 'trail' ? 0x5d9667 : 0x547f70, roughness: 1 })
  const mapPath = new THREE.MeshStandardMaterial({ color: mapId.value === 'grove' ? 0xb49367 : 0xc99f6b, roughness: .98 })
  addMesh(mapRoot, new THREE.PlaneGeometry(230, 190), new THREE.MeshStandardMaterial({ color: 0x5d9faf, roughness: .96 }), [0, -1.6, -6]).rotation.x = -Math.PI / 2
  addMesh(mapRoot, new THREE.BoxGeometry(32, 1.35, 48), mapGround, [0, -.75, -6])
  addMesh(mapRoot, new THREE.BoxGeometry(5.4, .15, 48), mapPath, [0, -.03, -6])

  if (mapId.value === 'town') {
    addHouse(mapRoot, -8, -12, 1, 0x6284a0)
    addHouse(mapRoot, 8, -12, .92, 0x7b739b)
    const fountain = addMesh(mapRoot, new THREE.CylinderGeometry(2.1, 2.35, .24, 16), new THREE.MeshStandardMaterial({ color: 0xe3cf9f, roughness: .8 }), [0, .12, 5])
    addMesh(mapRoot, new THREE.CylinderGeometry(1.2, 1.4, .42, 14), new THREE.MeshStandardMaterial({ color: 0x6da8b1, roughness: .34, metalness: .1 }), [0, .38, 5])
    fountain.rotation.x = 0
    createSavePoint(mapRoot)
    npcs.filter((npc) => npc.map === 'town').forEach(createNpc)
  }

  if (mapId.value === 'trail') {
    addHill(mapRoot, -15, -14, 1.2, 0x6d9b86)
    addHill(mapRoot, 15, -22, 1.35, 0x719f82)
    addMesh(mapRoot, new THREE.CircleGeometry(6, 32), new THREE.MeshStandardMaterial({ color: 0x68adbd, roughness: .35, metalness: .05, transparent: true, opacity: .9 }), [9, -.03, -8]).rotation.x = -Math.PI / 2
    const treeSpots: Array<[number, number, number]> = [[-10, 4, 1], [10, -2, .9], [-10, -9, .86], [11, -16, 1.08], [-10, -24, .92]]
    treeSpots.forEach(([x, z, scale], index) => addTree(mapRoot!, x, z, scale, index % 2 ? 0x5b9b6e : 0x4b8c64))
    createNpc(npcs.find((npc) => npc.id === 'sora')!)
  }

  if (mapId.value === 'grove') {
    addHill(mapRoot, -14, -20, 1.35, 0x668c7b)
    addHill(mapRoot, 14, -16, 1.2, 0x6d927b)
    addCrystal(mapRoot, -8, -6, 0x73d5cf, .8)
    addCrystal(mapRoot, 7, -8, 0xb1d76f, .72)
    addCrystal(mapRoot, -7, -22, 0xb997e8, .9)
    addCrystal(mapRoot, 7, -24, 0xf2c875, .76)
    const groveTrees: Array<[number, number, number]> = [[-10, 4, 1.1], [10, 3, 1], [-11, -13, .94], [11, -15, 1.2]]
    groveTrees.forEach(([x, z, scale], index) => addTree(mapRoot!, x, z, scale, index % 2 ? 0x477d62 : 0x3f735f))
    addMesh(mapRoot, new THREE.CircleGeometry(5.5, 30), new THREE.MeshStandardMaterial({ color: 0x6bb1b5, roughness: .3, transparent: true, opacity: .88 }), [0, -.02, -10]).rotation.x = -Math.PI / 2
  }

  transitions.filter((transition) => transition.from === mapId.value).forEach((transition) => addMapMarker(mapRoot!, [transition.position[0], 0, transition.position[1]], transition.to === 'town' ? 0xffd180 : 0x9be5e2))
  creatures.filter((creature) => creature.wild && creature.spawn?.map === mapId.value).forEach(createCreature)
  createClouds()
  if (destinationMarker) mapRoot.add(destinationMarker)
  refreshCreatureSelection()
}

function createClouds() {
  if (!scene) return
  cloudGroup?.parent?.remove(cloudGroup)
  cloudGroup = new THREE.Group()
  const material = new THREE.SpriteMaterial({ map: getGlowTexture(), color: 0xf6fbf2, transparent: true, opacity: .13, depthWrite: false })
  for (let index = 0; index < 6; index += 1) {
    const cloud = new THREE.Sprite(material)
    cloud.position.set(Math.sin(index * 8.2) * 15, 8 + (index % 3) * 1.8, -10 - index * 12)
    cloud.scale.set(8 + (index % 3) * 3, 2.2, 1)
    cloudGroup.add(cloud)
  }
  scene.add(cloudGroup)
}

function disposeMap() {
  if (!mapRoot) return
  mapRoot.traverse((object) => {
    const mesh = object as THREE.Mesh
    if (mesh.geometry) mesh.geometry.dispose()
    if (Array.isArray(mesh.material)) mesh.material.forEach((material) => material.dispose())
    else if (mesh.material) mesh.material.dispose()
  })
  mapRoot.parent?.remove(mapRoot)
  mapRoot = null
  savePoint = null
}

function createPlayer() {
  const group = new THREE.Group()
  group.position.set(playerPosition.value.x, 0, playerPosition.value.z)
  const body = new THREE.MeshStandardMaterial({ color: 0x385f78, roughness: .78 })
  const cloth = new THREE.MeshStandardMaterial({ color: 0xf0c575, roughness: .7 })
  const skin = new THREE.MeshStandardMaterial({ color: 0xf0c09f, roughness: .8 })
  const hair = new THREE.MeshStandardMaterial({ color: 0x493a5e, roughness: .86 })
  addMesh(group, new THREE.CylinderGeometry(.48, .62, 1.35, 8), body, [0, 1.15, 0])
  addMesh(group, new THREE.SphereGeometry(.48, 12, 10), skin, [0, 2.05, 0])
  addMesh(group, new THREE.SphereGeometry(.5, 12, 8), hair, [0, 2.32, -.02], [1.05, .52, 1.05])
  addMesh(group, new THREE.ConeGeometry(.88, .5, 6), cloth, [0, 2.62, 0])
  addMesh(group, new THREE.CylinderGeometry(.13, .15, .72, 7), body, [-.27, .35, 0])
  addMesh(group, new THREE.CylinderGeometry(.13, .15, .72, 7), body, [.27, .35, 0])
  addMesh(group, new THREE.SphereGeometry(.3, 10, 8), cloth, [0, 1.15, .46], [.9, 1.2, .45])
  scene?.add(group)
  playerGroup = group
}

function refreshCreatureSelection() {
  creatureVisuals.forEach((visual, id) => {
    const active = selectedCreature.value?.id === id
    const material = visual.ring.material as THREE.MeshBasicMaterial
    material.opacity = active ? .86 : .08
    visual.ring.scale.setScalar(active ? 1.15 : 1)
  })
}

function updatePointer(event: PointerEvent) {
  if (!canvasRef.value) return
  const rect = canvasRef.value.getBoundingClientRect()
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
}

function pickInteractive(event: PointerEvent) {
  if (!camera || !canvasRef.value || viewMode.value !== 'world') return
  updatePointer(event)
  raycaster.setFromCamera(pointer, camera)
  const roots = [...creatureVisuals.values()].map((visual) => visual.group).concat([...npcVisuals.values()])
  const hits = raycaster.intersectObjects(roots, true)
  const hit = hits[0]
  if (!hit) return
  const creatureId = hit.object.userData.creatureId as string | undefined
  const npcId = hit.object.userData.npcId as string | undefined
  if (creatureId) {
    selectedCreature.value = creatures.find((creature) => creature.id === creatureId) ?? null
    selectedNpc.value = null
    refreshCreatureSelection()
  } else if (npcId) {
    selectedNpc.value = npcs.find((npc) => npc.id === npcId) ?? null
    selectedCreature.value = null
    refreshCreatureSelection()
  }
}

function onPointerDown(event: PointerEvent) {
  pointerStart = { x: event.clientX, y: event.clientY }
  lastPointer = { x: event.clientX, y: event.clientY }
  pointerMoved = false
  canvasRef.value?.setPointerCapture(event.pointerId)
}

function onPointerMove(event: PointerEvent) {
  if (!pointerStart || viewMode.value !== 'world') return
  const dx = event.clientX - lastPointer.x
  const dy = event.clientY - lastPointer.y
  if (Math.abs(event.clientX - pointerStart.x) + Math.abs(event.clientY - pointerStart.y) > 5) pointerMoved = true
  cameraYaw -= dx * .006
  cameraHeight = Math.max(2.7, Math.min(7.4, cameraHeight + dy * .018))
  lastPointer = { x: event.clientX, y: event.clientY }
}

function onPointerUp(event: PointerEvent) {
  if (pointerStart && !pointerMoved) pickInteractive(event)
  pointerStart = null
  canvasRef.value?.releasePointerCapture(event.pointerId)
}

function onWheel(event: WheelEvent) {
  event.preventDefault()
  cameraDistance = Math.max(5, Math.min(12, cameraDistance + event.deltaY * .008))
}

function setTouchDirection(direction: keyof typeof touchFlags, active: boolean) {
  touchFlags[direction] = active
}

function updatePlayer(delta: number) {
  if (!playerGroup || viewMode.value !== 'world' || transitionBusy) return
  const forward = Number(keys.has('w') || keys.has('arrowup') || touchFlags.up) - Number(keys.has('s') || keys.has('arrowdown') || touchFlags.down)
  const sideways = Number(keys.has('d') || keys.has('arrowright') || touchFlags.right) - Number(keys.has('a') || keys.has('arrowleft') || touchFlags.left)
  if (!forward && !sideways) {
    playerPosition.value.x = playerGroup.position.x
    playerPosition.value.z = playerGroup.position.z
    checkNearby()
    return
  }
  const direction = new THREE.Vector3(sideways, 0, -forward)
  direction.applyAxisAngle(new THREE.Vector3(0, 1, 0), cameraYaw).normalize()
  const speed = keys.has('shift') ? 7.2 : 4.6
  playerGroup.position.x = THREE.MathUtils.clamp(playerGroup.position.x + direction.x * speed * delta, -12.8, 12.8)
  playerGroup.position.z = THREE.MathUtils.clamp(playerGroup.position.z + direction.z * speed * delta, -27, 14)
  playerGroup.rotation.y = Math.atan2(direction.x, direction.z) + Math.PI
  playerWalkPhase += delta * (keys.has('shift') ? 12 : 8)
  playerGroup.position.y = reducedMotion.value ? 0 : Math.abs(Math.sin(playerWalkPhase)) * .055
  playerPosition.value.x = playerGroup.position.x
  playerPosition.value.z = playerGroup.position.z
  if (destinationMarker) destinationMarker.position.set(playerGroup.position.x, .08, playerGroup.position.z)
  checkNearby()
}

function checkNearby() {
  if (!playerGroup || viewMode.value !== 'world') return
  const player = new THREE.Vector2(playerGroup.position.x, playerGroup.position.z)
  if (savePoint && mapId.value === 'town') {
    const distance = player.distanceTo(new THREE.Vector2(savePoint.position.x, savePoint.position.z))
    saveAvailable.value = distance < 2.8
  } else saveAvailable.value = false

  const transition = transitions.find((candidate) => candidate.from === mapId.value && player.distanceTo(new THREE.Vector2(candidate.position[0], candidate.position[1])) < 2.3)
  if (transition) switchMap(transition.to, transition.entry, transition.label)

  if (mapId.value !== 'town') {
    const target = [...creatureVisuals.entries()].map(([id, visual]) => ({ id, visual })).find(({ visual }) => visual.group.visible && player.distanceTo(new THREE.Vector2(visual.group.position.x, visual.group.position.z)) < 1.8)
    if (target) {
      const found = creatures.find((creature) => creature.id === target.id)
      if (found) startBattle(found)
    }
  }
}

function switchMap(nextMap: MapId, entry: [number, number], label: string) {
  if (transitionBusy || viewMode.value !== 'world' || !playerGroup) return
  transitionBusy = true
  notice.value = label
  const finish = () => {
    mapId.value = nextMap
    playerGroup!.position.set(entry[0], 0, entry[1])
    playerPosition.value = { x: entry[0], z: entry[1] }
    createMap()
    if (destinationMarker && mapRoot) mapRoot.add(destinationMarker)
    gsap.to(mapFadeRef.value, { autoAlpha: 0, duration: reducedMotion.value ? .01 : .45, ease: 'power2.out', onComplete: () => { transitionBusy = false } })
  }
  if (reducedMotion.value) {
    gsap.set(mapFadeRef.value, { autoAlpha: 1 })
    finish()
  } else {
    gsap.to(mapFadeRef.value, { autoAlpha: 1, duration: .28, ease: 'power2.in', onComplete: finish })
  }
}

function gainExperience(amount: number) {
  playerXp.value += amount
  while (playerXp.value >= expToNext.value) {
    playerXp.value -= expToNext.value
    playerLevel.value += 1
    notice.value = `升级！${copy.value.level} ${playerLevel.value}`
  }
}

function startBattle(target: CreatureData) {
  if (viewMode.value !== 'world' || !target.wild || caughtIds.value.includes(target.id) || defeatedIds.value.includes(target.id)) return
  const visual = creatureVisuals.get(target.id)
  if (visual) visual.group.visible = false
  selectedCreature.value = target
  battle.value = { enemy: target, enemyHp: target.maxHp, playerHp: activeCreature.value.maxHp + playerLevel.value * 3, playerMaxHp: activeCreature.value.maxHp + playerLevel.value * 3, message: `${target.name} 出现了！`, result: null, captureAttempts: 0, busy: false }
  selectedNpc.value = null
  viewMode.value = 'battle'
  if (battleFlashRef.value) gsap.fromTo(battleFlashRef.value, { autoAlpha: .75 }, { autoAlpha: 0, duration: reducedMotion.value ? .01 : .55, ease: 'power2.out' })
}

function enemyTurn() {
  if (!battle.value) return
  const damage = Math.max(2, battle.value.enemy.attack + Math.floor(Math.random() * 3) - 1)
  battle.value.playerHp = Math.max(0, battle.value.playerHp - damage)
  if (battle.value.playerHp <= 0) {
    battle.value.result = 'lost'
    battle.value.message = copy.value.battleLoss
  } else {
    battle.value.message = `${battle.value.enemy.name} 反击，造成 ${damage} 点伤害。`
  }
  battle.value.busy = false
}

function attackEnemy() {
  if (!battle.value || battle.value.busy || battle.value.result) return
  battle.value.busy = true
  const damage = activeCreature.value.attack + playerLevel.value + Math.floor(Math.random() * 4)
  battle.value.enemyHp = Math.max(0, battle.value.enemyHp - damage)
  battle.value.message = `${activeCreature.value.name} 发起攻击，造成 ${damage} 点伤害。`
  if (battle.value.enemyHp <= 0) {
    battleTimer = window.setTimeout(() => finishBattle('defeated'), reducedMotion.value ? 1 : 480)
  } else {
    battleTimer = window.setTimeout(enemyTurn, reducedMotion.value ? 1 : 600)
  }
}

function captureEnemy() {
  if (!battle.value || battle.value.busy || battle.value.result) return
  battle.value.busy = true
  battle.value.captureAttempts += 1
  const weakened = battle.value.enemyHp <= battle.value.enemy.maxHp * .58
  const success = weakened || battle.value.captureAttempts >= 2
  battle.value.message = copy.value.captureHint
  if (success) {
    battleTimer = window.setTimeout(() => finishBattle('captured'), reducedMotion.value ? 1 : 650)
  } else {
    battle.value.message = `${battle.value.enemy.name} 从晶球中挣脱了！`
    battleTimer = window.setTimeout(enemyTurn, reducedMotion.value ? 1 : 650)
  }
}

function escapeBattle() {
  if (!battle.value || battle.value.busy || battle.value.result) return
  battle.value.result = 'escaped'
  battle.value.message = '你安全地离开了遭遇。'
}

function finishBattle(result: Exclude<BattleResult, null>) {
  if (!battle.value) return
  battle.value.result = result
  battle.value.busy = false
  if (result === 'captured' && !caughtIds.value.includes(battle.value.enemy.id)) {
    caughtIds.value.push(battle.value.enemy.id)
    gainExperience(18)
    battleWins.value += 1
    battle.value.message = `${battle.value.enemy.name} 加入了你的图鉴！${copy.value.battleWin}`
  } else if (result === 'defeated' && !defeatedIds.value.includes(battle.value.enemy.id)) {
    defeatedIds.value.push(battle.value.enemy.id)
    gainExperience(12)
    battleWins.value += 1
    battle.value.message = `${battle.value.enemy.name} 已退回森林。${copy.value.battleWin}`
  }
}

function returnToWorld() {
  if (!battle.value?.result) return
  if (battle.value.result === 'lost') {
    if (playerGroup) playerGroup.position.set(0, 0, 8)
    mapId.value = 'town'
    playerPosition.value = { x: 0, z: 8 }
    createMap()
  } else if (battle.value.result === 'captured' || battle.value.result === 'defeated') {
    const visual = creatureVisuals.get(battle.value.enemy.id)
    if (visual) visual.group.visible = false
  } else {
    const visual = creatureVisuals.get(battle.value.enemy.id)
    if (visual) visual.group.visible = true
  }
  battle.value = null
  viewMode.value = 'world'
  saveAvailable.value = false
}

function saveGame() {
  if (mapId.value !== 'town' || !saveAvailable.value) return
  const payload = { mapId: mapId.value, playerPosition: playerPosition.value, playerXp: playerXp.value, playerLevel: playerLevel.value, caughtIds: caughtIds.value, defeatedIds: defeatedIds.value, battleWins: battleWins.value, savedAt: new Date().toISOString() }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
  saveMessage.value = copy.value.saved
  notice.value = copy.value.saved
  window.setTimeout(() => { saveMessage.value = '' }, 2200)
}

function loadGame() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return
    const payload = JSON.parse(raw) as { mapId?: MapId; playerPosition?: { x: number; z: number }; playerXp?: number; playerLevel?: number; caughtIds?: string[]; defeatedIds?: string[]; battleWins?: number }
    if (payload.mapId && maps.some((map) => map.id === payload.mapId)) mapId.value = payload.mapId
    if (payload.playerPosition && Number.isFinite(payload.playerPosition.x) && Number.isFinite(payload.playerPosition.z)) playerPosition.value = payload.playerPosition
    playerXp.value = Number.isFinite(payload.playerXp) ? payload.playerXp ?? 0 : 0
    playerLevel.value = Number.isFinite(payload.playerLevel) ? payload.playerLevel ?? 1 : 1
    caughtIds.value = Array.isArray(payload.caughtIds) ? payload.caughtIds : []
    defeatedIds.value = Array.isArray(payload.defeatedIds) ? payload.defeatedIds : []
    battleWins.value = Number.isFinite(payload.battleWins) ? payload.battleWins ?? 0 : 0
    notice.value = '已载入上次冒险'
  } catch {
    localStorage.removeItem(STORAGE_KEY)
  }
}

function onKeydown(event: KeyboardEvent) {
  const key = event.key.toLowerCase()
  if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'shift'].includes(key)) {
    event.preventDefault()
    keys.add(key)
  }
  if (key === 'e' && saveAvailable.value && viewMode.value === 'world') {
    event.preventDefault()
    saveGame()
  }
  if (key === 'escape') {
    selectedCreature.value = null
    selectedNpc.value = null
  }
}

function onKeyup(event: KeyboardEvent) {
  keys.delete(event.key.toLowerCase())
}

function clearInput() {
  keys.clear()
  Object.keys(touchFlags).forEach((key) => { touchFlags[key as keyof typeof touchFlags] = false })
}

function handleMotionChange() {
  reducedMotion.value = motionQuery?.matches ?? false
}

function handleMobileChange() {
  isMobile.value = mobileQuery?.matches ?? false
  resizeScene()
}

function handleResize() {
  window.clearTimeout(resizeTimer)
  resizeTimer = window.setTimeout(resizeScene, 120)
}

function resizeScene() {
  if (!renderer || !camera || !stageRef.value) return
  const rect = stageRef.value.getBoundingClientRect()
  renderer.setSize(Math.max(1, rect.width), Math.max(1, rect.height), false)
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6))
  camera.aspect = rect.width / Math.max(rect.height, 1)
  camera.fov = isMobile.value ? 67 : 58
  camera.updateProjectionMatrix()
}

function updateCamera(delta: number) {
  if (!camera || !playerGroup) return
  const offset = new THREE.Vector3(Math.sin(cameraYaw) * cameraDistance, cameraHeight, Math.cos(cameraYaw) * cameraDistance)
  const target = playerGroup.position.clone().add(offset)
  const ease = reducedMotion.value ? 1 : 1 - Math.pow(.0008, delta)
  camera.position.lerp(target, ease)
  camera.lookAt(playerGroup.position.clone().add(new THREE.Vector3(0, 1.35, 0)))
}

function renderFrame() {
  animationFrame = window.requestAnimationFrame(renderFrame)
  if (!renderer || !scene || !camera) return
  const delta = Math.min(ambientClock.getDelta(), .05)
  const elapsed = ambientClock.getElapsedTime()
  updatePlayer(delta)
  updateCamera(delta)
  if (!reducedMotion.value) {
    creatureVisuals.forEach((visual) => {
      visual.group.position.y = Math.sin(elapsed * 1.4 + visual.phase) * .06
      visual.group.rotation.y = Math.sin(elapsed * .75 + visual.phase) * .06
      visual.ring.rotation.z += delta * .35
    })
    if (cloudGroup) cloudGroup.position.x = Math.sin(elapsed * .025) * 2.5
    if (destinationMarker) destinationMarker.rotation.z = elapsed * .8
  }
  renderer.render(scene, camera)
}

function initScene() {
  if (!canvasRef.value) return
  scene = new THREE.Scene()
  scene.background = new THREE.Color(0x88b6c8)
  scene.fog = new THREE.FogExp2(0x88b6c8, .011)
  camera = new THREE.PerspectiveCamera(58, 1, .1, 260)
  camera.position.set(0, 4.4, 20)
  renderer = new THREE.WebGLRenderer({ canvas: canvasRef.value, antialias: true, powerPreference: 'high-performance' })
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.18
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap
  const hemisphere = new THREE.HemisphereLight(0xdff5ff, 0x3b725c, 2.35)
  scene.add(hemisphere)
  const sun = new THREE.DirectionalLight(0xffe6b8, 3.2)
  sun.position.set(-14, 20, 14)
  sun.castShadow = true
  sun.shadow.mapSize.set(1024, 1024)
  scene.add(sun)
  const fill = new THREE.DirectionalLight(0x9bd4de, .85)
  fill.position.set(14, 8, -28)
  scene.add(fill)
  destinationMarker = new THREE.Mesh(new THREE.RingGeometry(.42, .5, 24), new THREE.MeshBasicMaterial({ color: 0xffe0a2, transparent: true, opacity: .8, side: THREE.DoubleSide }))
  destinationMarker.rotation.x = -Math.PI / 2
  createMap()
  createPlayer()
  if (mapRoot) mapRoot.add(destinationMarker)
  refreshCreatureSelection()
  resizeScene()
  ambientClock.start()
  renderFrame()
}

onMounted(() => {
  motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
  mobileQuery = window.matchMedia('(max-width: 767px)')
  reducedMotion.value = motionQuery.matches
  isMobile.value = mobileQuery.matches
  loadGame()
  motionQuery.addEventListener('change', handleMotionChange)
  mobileQuery.addEventListener('change', handleMobileChange)
  window.addEventListener('keydown', onKeydown)
  window.addEventListener('keyup', onKeyup)
  window.addEventListener('blur', clearInput)
  window.addEventListener('resize', handleResize)
  initScene()
})

onBeforeUnmount(() => {
  window.cancelAnimationFrame(animationFrame)
  window.clearTimeout(resizeTimer)
  window.clearTimeout(battleTimer)
  motionQuery?.removeEventListener('change', handleMotionChange)
  mobileQuery?.removeEventListener('change', handleMobileChange)
  window.removeEventListener('keydown', onKeydown)
  window.removeEventListener('keyup', onKeyup)
  window.removeEventListener('blur', clearInput)
  window.removeEventListener('resize', handleResize)
  disposeMap()
  scene?.traverse((object) => {
    const mesh = object as THREE.Mesh
    if (mesh.geometry) mesh.geometry.dispose()
    if (Array.isArray(mesh.material)) mesh.material.forEach((material) => material.dispose())
    else if (mesh.material) mesh.material.dispose()
  })
  glowTexture?.dispose()
  renderer?.dispose()
})
</script>

<template>
  <section ref="stageRef" class="wild-stage" :class="{ 'is-mobile': isMobile, 'no-motion': reducedMotion, 'battle-mode': viewMode === 'battle' }" :aria-label="copy.worldLabel">
    <canvas
      ref="canvasRef"
      class="wild-canvas"
      aria-label="Interactive 3D creature world"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @pointercancel="pointerStart = null"
      @wheel.prevent="onWheel"
      @contextmenu.prevent
    ></canvas>

    <div class="wild-grade" aria-hidden="true"></div>
    <div class="wild-fog" aria-hidden="true"></div>
    <div ref="mapFadeRef" class="map-fade" aria-hidden="true"></div>
    <div ref="battleFlashRef" class="battle-flash" aria-hidden="true"></div>

    <div class="wild-intro">
      <p class="wild-kicker">{{ copy.worldLabel }}</p>
      <h1>{{ copy.title }}</h1>
      <p class="wild-subtitle">{{ copy.subtitle }}</p>
      <p class="wild-description">{{ copy.intro }}</p>
      <p class="wild-region"><span></span>{{ currentMap.name }} <b>·</b> {{ currentMap.description }}</p>
    </div>

    <div class="map-strip" aria-label="Maps">
      <span class="map-strip-label">{{ copy.mapLabel }}</span>
      <span v-for="map in maps" :key="map.id" class="map-chip" :class="{ active: map.id === mapId }">{{ language === 'EN' ? map.englishName : map.name }}</span>
    </div>

    <aside v-if="viewMode === 'world'" class="creature-card" :class="{ 'card-empty': !selectedCreature }" aria-live="polite">
      <div class="creature-card-top">
        <span class="creature-card-label">{{ selectedNpc ? copy.npcLabel : copy.guide }}</span>
        <button v-if="selectedCreature || selectedNpc" class="card-close" type="button" aria-label="Close record" @click="selectedCreature = null; selectedNpc = null">×</button>
      </div>
      <template v-if="selectedNpc">
        <div class="creature-card-title"><span class="creature-dot npc-dot"></span><div><h2>{{ selectedNpc.name }}</h2><p>{{ selectedNpc.role }}</p></div></div>
        <p class="creature-description">{{ selectedNpc.dialog }}</p>
        <button class="world-cta" type="button" @click="selectedNpc = null">{{ copy.talk }}</button>
      </template>
      <template v-else-if="selectedCreature">
        <div class="creature-card-title">
          <span class="creature-dot" :style="{ background: `#${selectedCreature.color.toString(16).padStart(6, '0')}` }"></span>
          <div><h2>{{ language === 'EN' ? selectedCreature.englishName : selectedCreature.name }}</h2><p>{{ selectedCreature.name }} · {{ selectedCreature.englishName }}</p></div>
        </div>
        <p class="creature-description">{{ selectedCreature.description }}</p>
        <dl class="creature-meta"><div><dt>属性</dt><dd>{{ selectedCreature.element }}</dd></div><div><dt>{{ copy.level }}</dt><dd>{{ selectedCreature.level }}</dd></div></dl>
        <p v-if="selectedStatus" class="creature-record">{{ selectedStatus }}</p>
        <button v-else-if="selectedCreature.wild" class="world-cta" type="button" @click="startBattle(selectedCreature)">{{ copy.startBattle }}</button>
      </template>
      <template v-else>
        <div class="creature-card-title"><span class="creature-dot empty-dot"></span><div><h2>{{ copy.nearby }}</h2><p>{{ copy.bestiary }}</p></div></div>
        <p class="creature-empty">{{ copy.noCreature }}</p>
      </template>
    </aside>

    <aside class="player-hud" aria-label="Player progress">
      <div class="player-hud-head"><span>{{ copy.yourPartner }}</span><b>{{ activeCreature.name }}</b></div>
      <div class="player-hud-level"><strong>{{ copy.level }} {{ playerLevel }}</strong><span>{{ playerXp }} / {{ expToNext }} {{ copy.exp }}</span></div>
      <div class="xp-track"><span :style="{ width: `${expProgress}%` }"></span></div>
      <p>{{ caughtCount }} {{ copy.caught }} · {{ battleWins }} {{ copy.battle }}</p>
    </aside>

    <div v-if="saveAvailable && viewMode === 'world'" class="save-prompt">
      <span>{{ copy.saveHint }}</span>
      <button class="world-cta" type="button" @click="saveGame">{{ copy.save }} <kbd>E</kbd></button>
    </div>
    <div v-if="saveMessage" class="save-toast">{{ saveMessage }}</div>
    <div v-if="notice && !saveMessage" class="world-notice">{{ notice }}</div>

    <div class="world-controls"><p>{{ isMobile ? copy.touch : copy.movement }}</p><p>{{ copy.camera }}</p></div>
    <p class="world-count">{{ copy.bestiary }}</p>

    <div v-if="isMobile && viewMode === 'world'" class="touch-pad" aria-label="Movement controls">
      <button type="button" aria-label="Move forward" @pointerdown="setTouchDirection('up', true)" @pointerup="setTouchDirection('up', false)" @pointerleave="setTouchDirection('up', false)">▲</button>
      <div><button type="button" aria-label="Move left" @pointerdown="setTouchDirection('left', true)" @pointerup="setTouchDirection('left', false)" @pointerleave="setTouchDirection('left', false)">◀</button><button type="button" aria-label="Move backward" @pointerdown="setTouchDirection('down', true)" @pointerup="setTouchDirection('down', false)" @pointerleave="setTouchDirection('down', false)">▼</button><button type="button" aria-label="Move right" @pointerdown="setTouchDirection('right', true)" @pointerup="setTouchDirection('right', false)" @pointerleave="setTouchDirection('right', false)">▶</button></div>
    </div>

    <section v-if="viewMode === 'battle' && battle" class="battle-overlay" aria-label="Battle screen">
      <div class="battle-sky" aria-hidden="true"></div>
      <div class="battle-topline"><span>{{ copy.battleTitle }}</span><b>{{ currentMap.name }}</b></div>
      <div class="battle-enemy">
        <div class="battle-creature-orb" :style="{ '--creature-color': `#${battle.enemy.color.toString(16).padStart(6, '0')}` }"><span></span></div>
        <div class="battle-name"><strong>{{ language === 'EN' ? battle.enemy.englishName : battle.enemy.name }}</strong><small>{{ battle.enemy.name }} · {{ copy.level }} {{ battle.enemy.level }}</small></div>
        <div class="battle-hp"><span><i>HP</i>{{ battle.enemyHp }} / {{ battle.enemy.maxHp }}</span><div><b :style="{ width: `${(battle.enemyHp / battle.enemy.maxHp) * 100}%` }"></b></div></div>
      </div>
      <div class="battle-partner">
        <div class="battle-name"><strong>{{ activeCreature.name }}</strong><small>{{ copy.yourPartner }} · {{ copy.level }} {{ playerLevel }}</small></div>
        <div class="battle-hp"><span><i>HP</i>{{ battle.playerHp }} / {{ battle.playerMaxHp }}</span><div><b :style="{ width: `${(battle.playerHp / battle.playerMaxHp) * 100}%` }"></b></div></div>
        <div class="battle-partner-orb"><span></span></div>
      </div>
      <div class="battle-command">
        <p>{{ battle.message }}</p>
        <div v-if="!battle.result" class="battle-actions"><button class="world-cta" type="button" :disabled="battle.busy" @click="attackEnemy">{{ copy.attack }}</button><button class="world-cta world-cta-cyan" type="button" :disabled="battle.busy" @click="captureEnemy">{{ copy.capture }}</button><button class="world-cta world-cta-ghost" type="button" :disabled="battle.busy" @click="escapeBattle">{{ copy.run }}</button></div>
        <div v-else class="battle-actions"><span class="battle-result">{{ battle.message }}</span><button class="world-cta" type="button" @click="returnToWorld">{{ copy.backToWorld }}</button></div>
      </div>
    </section>
  </section>
</template>
