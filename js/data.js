// Base de exercícios: free-exercise-db (domínio público), com nomes PT para os mais comuns.
const IMG_BASE = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/';

export const MUSCLES = {
  chest: 'Peito', shoulders: 'Ombros', triceps: 'Tríceps', biceps: 'Bíceps',
  lats: 'Dorsais', 'middle back': 'Costas (meio)', 'lower back': 'Lombar', traps: 'Trapézio',
  quadriceps: 'Quadríceps', hamstrings: 'Isquiotibiais', glutes: 'Glúteos', calves: 'Gémeos',
  abdominals: 'Abdominais', forearms: 'Antebraços', adductors: 'Adutores', abductors: 'Abdutores', neck: 'Pescoço',
};

export const EQUIPMENT = {
  barbell: 'Barra', dumbbell: 'Halteres', machine: 'Máquina', cable: 'Cabo', 'body only': 'Peso corporal',
  kettlebells: 'Kettlebell', 'e-z curl bar': 'Barra EZ', bands: 'Elásticos', other: 'Outro',
  'medicine ball': 'Bola medicinal', 'exercise ball': 'Bola suíça', 'foam roll': 'Rolo',
};

// Grupos usados no equilíbrio empurrar/puxar/pernas
export const GROUP = {
  chest: 'push', shoulders: 'push', triceps: 'push',
  lats: 'pull', 'middle back': 'pull', biceps: 'pull', traps: 'pull', forearms: 'pull',
  quadriceps: 'legs', hamstrings: 'legs', glutes: 'legs', calves: 'legs', adductors: 'legs', abductors: 'legs',
  abdominals: 'core', 'lower back': 'core', neck: 'core',
};

export const PT_NAMES = {
  'Barbell_Bench_Press_-_Medium_Grip': 'Supino reto (barra)',
  'Barbell_Incline_Bench_Press_-_Medium_Grip': 'Supino inclinado (barra)',
  'Dumbbell_Bench_Press': 'Supino reto (halteres)',
  'Incline_Dumbbell_Press': 'Supino inclinado (halteres)',
  'Close-Grip_Barbell_Bench_Press': 'Supino pega fechada',
  'Machine_Bench_Press': 'Supino na máquina',
  'Leverage_Chest_Press': 'Chest press (máquina)',
  'Dumbbell_Flyes': 'Aberturas (halteres)',
  'Incline_Dumbbell_Flyes': 'Aberturas inclinadas',
  'Butterfly': 'Peck deck',
  'Cable_Crossover': 'Crossover (cabo)',
  'Dips_-_Chest_Version': 'Fundos (peito)',
  'Pushups': 'Flexões',
  'Barbell_Squat': 'Agachamento (barra)',
  'Front_Barbell_Squat': 'Agachamento frontal',
  'Goblet_Squat': 'Agachamento goblet',
  'Smith_Machine_Squat': 'Agachamento Smith',
  'Hack_Squat': 'Hack squat',
  'Leg_Press': 'Leg press',
  'Leg_Extensions': 'Leg extension (máquina)',
  'Lying_Leg_Curls': 'Leg curl (máquina)',
  'Seated_Leg_Curl': 'Curl femoral sentado',
  'Dumbbell_Lunges': 'Afundos (halteres)',
  'Barbell_Lunge': 'Afundos (barra)',
  'Barbell_Hip_Thrust': 'Hip thrust',
  'Romanian_Deadlift': 'Peso morto romeno',
  'Barbell_Deadlift': 'Peso morto',
  'Sumo_Deadlift': 'Peso morto sumo',
  'Standing_Calf_Raises': 'Gémeos em pé',
  'Seated_Calf_Raise': 'Gémeos sentado',
  'Pullups': 'Elevações',
  'Chin-Up': 'Elevações supinadas',
  'Wide-Grip_Lat_Pulldown': 'Lat pulldown',
  'Leverage_High_Row': 'Remada alta (máquina)',
  'One_Arm_Dumbbell_Preacher_Curl': 'Preacher curl unilateral (halter)',
  'Calf_Press_On_The_Leg_Press_Machine': 'Gémeos na leg press',
  'Leverage_Shoulder_Press': 'Shoulder press (máquina)',
  'Front_Cable_Raise': 'Elevação frontal (polia)',
  'Cable_Seated_Lateral_Raise': 'Elevação lateral (polia)',
  'Reverse_Machine_Flyes': 'Posterior de ombro (peck deck)',
  'Decline_Crunch': 'Abdominal banco declinado',
  'Cable_Rear_Delt_Fly': 'Posterior de ombro (polia)',
  'Incline_Cable_Flye': 'Aberturas inclinadas (polia)',
  'Straight-Arm_Pulldown': 'Pullover na polia',
  'Cable_Rope_Overhead_Triceps_Extension': 'Tríceps francês (corda)',
  'Hyperextensions_Back_Extensions': 'Hiperextensões',
  'Thigh_Adductor': 'Adutora (máquina)',
  'Seated_Cable_Rows': 'Remada sentada (cabo)',
  'Bent_Over_Barbell_Row': 'Remada curvada (barra)',
  'One-Arm_Dumbbell_Row': 'Remada unilateral (halter)',
  'T-Bar_Row_with_Handle': 'Remada T',
  'Face_Pull': 'Face pull',
  'Barbell_Shrug': 'Encolhimentos (barra)',
  'Dumbbell_Shrug': 'Encolhimentos (halteres)',
  'Standing_Military_Press': 'Press militar',
  'Dumbbell_Shoulder_Press': 'Press de ombros (halteres)',
  'Seated_Dumbbell_Press': 'Press sentado (halteres)',
  'Arnold_Dumbbell_Press': 'Arnold press',
  'Side_Lateral_Raise': 'Elevações laterais',
  'Reverse_Flyes': 'Aberturas invertidas',
  'Barbell_Curl': 'Curl com barra',
  'EZ-Bar_Curl': 'Curl barra EZ',
  'Dumbbell_Bicep_Curl': 'Curl com halteres',
  'Hammer_Curls': 'Curl martelo',
  'Triceps_Pushdown': 'Extensão tríceps (cabo)',
  'Triceps_Pushdown_-_Rope_Attachment': 'Tríceps na polia (corda)',
  'Lying_Triceps_Press': 'Skull crusher',
  'Dips_-_Triceps_Version': 'Fundos (tríceps)',
  'Cable_Crunch': 'Crunch na polia',
  'Hanging_Leg_Raise': 'Elevação de pernas suspenso',
  'Plank': 'Prancha',
};

let cache = null;
let byId = new Map();

export async function loadExercises() {
  if (cache) return cache;
  const res = await fetch('data/exercises.json');
  const raw = await res.json();
  cache = raw.map((x) => ({
    id: x.i,
    name: PT_NAMES[x.i] || x.n,
    en: x.n,
    primary: x.p,
    secondary: x.s,
    equipment: x.e,
    instructions: x.t,
    popular: x.i in PT_NAMES,
  }));
  cache.sort((a, b) => (b.popular - a.popular) || a.name.localeCompare(b.name, 'pt'));
  byId = new Map(cache.map((e) => [e.id, e]));
  return cache;
}

export const getEx = (id) => byId.get(id) || { id, name: id.replace(/_/g, ' '), primary: [], secondary: [], equipment: 'other', instructions: [] };
export const img = (id, n = 0) => `${IMG_BASE}${encodeURIComponent(id)}/${n}.jpg`;
export const muscleName = (m) => MUSCLES[m] || m;

// Incremento sensato por tipo de equipamento
export function incrementFor(ex, base = 2.5) {
  if (ex.equipment === 'dumbbell' || ex.equipment === 'cable') return Math.max(1, base / 1.25);
  if (ex.equipment === 'barbell' && (ex.primary.includes('quadriceps') || ex.primary.includes('hamstrings') || ex.primary.includes('glutes') || ex.primary.includes('lower back'))) return base * 2;
  return base;
}

// O teu split (carregado na primeira vez que abres a app)
export const MY_SPLIT = [
  { name: 'Superiores', exercises: [
    ['Wide-Grip_Lat_Pulldown', 3], ['Leverage_High_Row', 3], ['Butterfly', 3],
    ['Barbell_Incline_Bench_Press_-_Medium_Grip', 3], ['One_Arm_Dumbbell_Preacher_Curl', 3], ['Triceps_Pushdown_-_Rope_Attachment', 3],
  ] },
  { name: 'Pernas', exercises: [
    ['Smith_Machine_Squat', 3], ['Lying_Leg_Curls', 3], ['Leg_Extensions', 3],
    ['Calf_Press_On_The_Leg_Press_Machine', 3], ['Barbell_Hip_Thrust', 3],
  ] },
  { name: 'Ombros + Abs', exercises: [
    ['Leverage_Shoulder_Press', 3], ['Front_Cable_Raise', 3], ['Cable_Seated_Lateral_Raise', 3],
    ['Reverse_Machine_Flyes', 3], ['Cable_Crunch', 2], ['Decline_Crunch', 2],
  ] },
];
