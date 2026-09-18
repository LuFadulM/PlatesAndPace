#!/usr/bin/env python3
"""Import the open exercise catalogue (free-exercise-db, Unlicense) into
src/data/catalogue.json and src/data/catalogue-steps.json.

    python3 scripts/import-catalogue.py            # fetch from GitHub
    python3 scripts/import-catalogue.py dump.json  # use a local copy

The catalogue complements the curated library in src/domain/exercises: it is
what the athlete browses when they want a movement the engine does not
program. Rows are mapped onto the app's own taxonomy (muscle group, material,
difficulty, type, purpose); the original vocabulary is kept alongside so
nothing is lost. Spanish names are built from a term glossary and every one
is flagged `nameEsReviewed: false` until a person checks it. Instructions
exist in English only; the UI says so rather than inventing a translation.

Source: https://github.com/yuhonas/free-exercise-db (public domain, Unlicense).
Photos are served from the same repository through raw.githubusercontent.com.
"""
import json, pathlib, re, sys, urllib.request

SOURCE = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json'
ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / 'src/data/catalogue.json'
OUT_STEPS = ROOT / 'src/data/catalogue-steps.json'
LIBRARY = ROOT / 'src/domain/exercises/library.ts'

MUSCLE = {  # dataset muscle -> app MuscleGroup
    'quadriceps': 'quads', 'hamstrings': 'hamstrings', 'glutes': 'glutes', 'calves': 'calves',
    'chest': 'chest', 'lats': 'back', 'middle back': 'back', 'lower back': 'back', 'traps': 'back',
    'shoulders': 'shoulders', 'biceps': 'biceps', 'forearms': 'biceps', 'triceps': 'triceps',
    'abdominals': 'abs', 'adductors': 'glutes', 'abductors': 'glutes', 'neck': 'back',
}
MATERIAL = {
    'barbell': 'barbell', 'e-z curl bar': 'barbell', 'dumbbell': 'dumbbell', 'kettlebells': 'kettlebell',
    'machine': 'machine', 'cable': 'cable', 'bands': 'band', 'medicine ball': 'medicine_ball',
    'exercise ball': 'stability_ball', 'body only': 'bodyweight', None: 'bodyweight',
    'other': 'other', 'foam roll': 'other',
}
LEVEL = {'beginner': 'beginner', 'intermediate': 'intermediate', 'expert': 'advanced'}

def kind(row):
    cat = row['category']
    if cat == 'stretching':
        return 'stretch', 'mobilise'
    if cat == 'cardio':
        return 'training', 'cardio'
    if cat in ('plyometrics', 'olympic weightlifting'):
        return 'training', 'nervous_system'
    if row.get('force') == 'static':
        return 'training', 'stabilise'
    return 'training', 'strengthen'

# --- Spanish names from a glossary -------------------------------------------
# Head nouns, longest phrase first. The Spanish noun leads; modifiers follow.
NOUNS = [
    ('Bench Press', 'Press de banca'), ('Chest Press', 'Press de pecho'), ('Shoulder Press', 'Press de hombro'),
    ('Military Press', 'Press militar'), ('Overhead Press', 'Press sobre la cabeza'), ('Leg Press', 'Prensa de piernas'),
    ('Push Press', 'Push press'), ('Floor Press', 'Press en el suelo'), ('Pin Press', 'Press desde soportes'),
    ('Good Morning', 'Buenos días'), ('Sit-Up', 'Abdominal'), ('Sit-Ups', 'Abdominales'), ('Push-Up', 'Flexión'), ('Push-Ups', 'Flexiones'), ('Pushups', 'Flexiones'),
    ("World's Greatest Stretch", 'El mejor estiramiento del mundo'),
    ('Dorsi-SMR', 'Automasaje dorsal con rodillo'), ('Tibialis-SMR', 'Automasaje del tibial con rodillo'),
    ('Brachialis-SMR', 'Automasaje del braquial con rodillo'), ('Calves-SMR', 'Automasaje de pantorrillas con rodillo'),
    ('Foot-SMR', 'Automasaje del pie con rodillo'), ('Hamstring-SMR', 'Automasaje de isquios con rodillo'),
    ('Peroneals-SMR', 'Automasaje de peroneos con rodillo'), ('Quadriceps-SMR', 'Automasaje de cuádriceps con rodillo'),
    ('Neck-SMR', 'Automasaje de cuello con rodillo'), ('Back-SMR', 'Automasaje de espalda con rodillo'),
    ('Rhomboids-SMR', 'Automasaje de romboides con rodillo'), ('Piriformis-SMR', 'Automasaje del piriforme con rodillo'),
    ('Tract-SMR', 'Automasaje de la banda iliotibial con rodillo'), ('Adductors-SMR', 'Automasaje de aductores con rodillo'),
    ('Pinch', 'Agarre de pinza'),
    ('Walking Lunge', 'Zancada caminando'), ('Side Lunge', 'Zancada lateral'), ('Reverse Lunge', 'Zancada inversa'),
    ('Glute-Ham Raise', 'Elevación glúteo-isquio'), ('Good Mornings', 'Buenos días'), ('Skullcrusher', 'Rompecráneos'),
    ('Push-up', 'Flexión'), ('Push-Up', 'Flexión'), ('Pushup', 'Flexión'), ('Pullup', 'Dominada'), ('Pull-Ups', 'Dominadas'),
    ('Sit Up', 'Abdominal'), ('Otis-Up', 'Abdominal Otis'), ('Butt-Ups', 'Elevación de glúteo'), ('Body-Up', 'Fondo en anillas'),
    ('Windmills', 'Molinos'), ('Wipers', 'Limpiaparabrisas'), ('Step-up', 'Subida al cajón'),
    ('Handstand', 'Pino'), ('Scaption', 'Elevación en escaición'), ('Hyperextension', 'Hiperextensión'),
    ('Face Pull', 'Face pull'), ('Inverted Row', 'Remo invertido'), ('T-Bar Row', 'Remo en T'), ('Pallof Press', 'Press Pallof'), ('Hip Flexor Stretch', 'Estiramiento de flexores de cadera'), ('Step Ups', 'Subida al cajón'), ('Pullups', 'Dominadas'), ('Chins', 'Dominadas'), ('Chin', 'Dominada'), ('Long Jump', 'Salto de longitud'), ('Pelvic Tilt', 'Báscula pélvica'), ('Stomach Vacuum', 'Vacío abdominal'), ('Battling Ropes', 'Cuerdas de batalla'), ('Jackknife', 'Navaja'), ('Tuck Jump', 'Salto con rodillas al pecho'), ('Renegade Row', 'Remo renegado'),
    ('Pull-Up', 'Dominada'), ('Pull-Ups', 'Dominadas'), ('Chin-Up', 'Dominada supina'), ('Chin-Ups', 'Dominadas supinas'), ('Muscle Up', 'Muscle-up'),
    ('Deadlift', 'Peso muerto'), ('Deadlifts', 'Peso muerto'), ('Romanian Deadlift', 'Peso muerto rumano'), ('Stiff-Legged Deadlift', 'Peso muerto piernas rígidas'),
    ('Hip Thrust', 'Empuje de cadera'), ('Glute Bridge', 'Puente de glúteo'), ('Bridge', 'Puente'), ('Hyperextension', 'Hiperextensión'), ('Hyperextensions', 'Hiperextensiones'),
    ('Leg Curl', 'Curl femoral'), ('Leg Curls', 'Curl femoral'), ('Hamstring Curl', 'Curl femoral'), ('Leg Extension', 'Extensión de cuádriceps'), ('Leg Extensions', 'Extensión de cuádriceps'),
    ('Calf Raise', 'Elevación de talones'), ('Calf Raises', 'Elevación de talones'), ('Calf Press', 'Press de pantorrilla'),
    ('Lateral Raise', 'Elevación lateral'), ('Lateral Raises', 'Elevaciones laterales'), ('Front Raise', 'Elevación frontal'), ('Front Raises', 'Elevaciones frontales'), ('Rear Delt Raise', 'Elevación posterior'), ('Delt Raise', 'Elevación de hombro'),
    ('Leg Raise', 'Elevación de piernas'), ('Leg Raises', 'Elevación de piernas'), ('Knee Raise', 'Elevación de rodillas'), ('Knee Raises', 'Elevación de rodillas'), ('Hip Raise', 'Elevación de cadera'), ('Raise', 'Elevación'), ('Raises', 'Elevaciones'),
    ('Pulldown', 'Jalón'), ('Pulldowns', 'Jalón'), ('Lat Pulldown', 'Jalón al pecho'), ('Pushdown', 'Extensión en polea'), ('Pushdowns', 'Extensión en polea'), ('Pullover', 'Pullover'), ('Pullovers', 'Pullover'),
    ('Upright Row', 'Remo al mentón'), ('Row', 'Remo'), ('Rows', 'Remo'), ('Shrug', 'Encogimiento de hombros'), ('Shrugs', 'Encogimientos de hombros'),
    ('Flyes', 'Aperturas'), ('Flye', 'Aperturas'), ('Fly', 'Aperturas'), ('Crossover', 'Cruce de poleas'), ('Crossovers', 'Cruce de poleas'),
    ('Curl', 'Curl'), ('Curls', 'Curl'), ('Preacher Curl', 'Curl en banco Scott'), ('Preacher Curls', 'Curl en banco Scott'), ('Hammer Curls', 'Curl martillo'), ('Hammer Curl', 'Curl martillo'), ('Concentration Curls', 'Curl concentrado'), ('Wrist Curl', 'Curl de muñeca'), ('Wrist Curls', 'Curl de muñeca'),
    ('Skull Crusher', 'Rompecráneos'), ('Skull Crushers', 'Rompecráneos'), ('Kickback', 'Patada'), ('Kickbacks', 'Patadas'), ('Extension', 'Extensión'), ('Extensions', 'Extensiones'), ('Dip', 'Fondos'), ('Dips', 'Fondos'),
    ('Squat', 'Sentadilla'), ('Squats', 'Sentadilla'), ('Front Squat', 'Sentadilla frontal'), ('Front Squats', 'Sentadilla frontal'), ('Hack Squat', 'Sentadilla hack'), ('Split Squat', 'Sentadilla dividida'), ('Split Squats', 'Sentadilla dividida'), ('Goblet Squat', 'Sentadilla goblet'), ('Jump Squat', 'Sentadilla con salto'), ('Pistol Squat', 'Sentadilla pistol'),
    ('Lunge', 'Zancada'), ('Lunges', 'Zancadas'), ('Step-Up', 'Subida al cajón'), ('Step-Ups', 'Subidas al cajón'), ('Step Up', 'Subida al cajón'),
    ('Clean and Jerk', 'Cargada y envión'), ('Clean and Press', 'Cargada y press'), ('Power Clean', 'Cargada de potencia'), ('Hang Clean', 'Cargada colgante'), ('Clean Pull', 'Tirón de cargada'), ('Clean', 'Cargada'), ('Cleans', 'Cargada'),
    ('Power Snatch', 'Arrancada de potencia'), ('Hang Snatch', 'Arrancada colgante'), ('Snatch Pull', 'Tirón de arrancada'), ('Snatch', 'Arrancada'), ('Jerk', 'Envión'), ('Thruster', 'Thruster'), ('Thrusters', 'Thruster'), ('High Pull', 'Tirón alto'), ('High Pulls', 'Tirón alto'),
    ('Swing', 'Swing'), ('Swings', 'Swing'), ('Windmill', 'Molino'), ('Turkish Get-Up', 'Levantamiento turco'), ('Get-Up', 'Levantamiento'), ('Halo', 'Halo'), ('Figure 8', 'Ocho'),
    ('Crunch', 'Crunch'), ('Crunches', 'Crunch'), ('Plank', 'Plancha'), ('Planks', 'Plancha'), ('Twist', 'Giro'), ('Twists', 'Giros'), ('Rollout', 'Rueda abdominal'), ('Rollouts', 'Rueda abdominal'), ('Mountain Climber', 'Escalador'), ('Mountain Climbers', 'Escaladores'),
    ('Jump', 'Salto'), ('Jumps', 'Saltos'), ('Hop', 'Salto'), ('Hops', 'Saltos'), ('Bound', 'Salto largo'), ('Leap', 'Salto'), ('Box Jump', 'Salto al cajón'), ('Broad Jump', 'Salto horizontal'), ('Depth Jump', 'Salto en profundidad'), ('Burpee', 'Burpee'),
    ('Stretch', 'Estiramiento'), ('Stretches', 'Estiramientos'), ('Rotation', 'Rotación'), ('Rotations', 'Rotaciones'), ('Circles', 'Círculos'), ('Circle', 'Círculo'),
    ('Walk', 'Paseo'), ('Walking', 'Caminata'), ('Carry', 'Paseo con carga'), ("Farmer's Walk", 'Paseo del granjero'), ('Sled Push', 'Empuje de trineo'), ('Sled Pull', 'Arrastre de trineo'), ('Sled Drag', 'Arrastre de trineo'), ('Drag', 'Arrastre'), ('Push', 'Empuje'), ('Pull', 'Tirón'), ('Pulls', 'Tirones'), ('Press', 'Press'), ('Presses', 'Press'),
    ('Throw', 'Lanzamiento'), ('Throws', 'Lanzamientos'), ('Slam', 'Lanzamiento al suelo'), ('Slams', 'Lanzamientos al suelo'), ('Toss', 'Lanzamiento'), ('Pass', 'Pase'), ('Chop', 'Leñador'), ('Chops', 'Leñador'), ('Woodchopper', 'Leñador'),
    ('Sprint', 'Sprint'), ('Sprints', 'Sprints'), ('Run', 'Carrera'), ('Running', 'Carrera'), ('Jog', 'Trote'), ('Skip', 'Skipping'), ('Skipping', 'Skipping'), ('Rope Jumping', 'Salto de cuerda'), ('Rowing', 'Remo'), ('Bike', 'Bicicleta'), ('Bicycling', 'Bicicleta'), ('Elliptical Trainer', 'Elíptica'), ('Stairmaster', 'Escaladora'), ('Treadmill', 'Cinta'), ('Trainer', 'Máquina'),
    ('Kick', 'Patada'), ('Kicks', 'Patadas'), ('Hold', 'Isométrico'), ('Crawl', 'Gateo'), ('Roll', 'Rodillo'), ('Rolling', 'Rodillo'), ('Drill', 'Ejercicio'), ('Shuffle', 'Desplazamiento lateral'), ('Balance', 'Equilibrio'), ('Lift', 'Levantamiento'), ('Thrust', 'Empuje'), ('Flip', 'Volteo'), ('Touchers', 'Toques'), ('Pull-In', 'Recogida'), ('Tuck', 'Recogida'), ('Reach', 'Alcance'), ('Flexion', 'Flexión'), ('Adduction', 'Aducción'), ('Abduction', 'Abducción'), ('Bend', 'Flexión lateral'), ('Bends', 'Flexiones laterales'), ('Superman', 'Superman'), ('Bird Dog', 'Bird dog'), ('Dead Bug', 'Bicho muerto'), ('Scissors', 'Tijeras'), ('Flutter Kicks', 'Patadas de tijera'), ('Frog', 'Rana'), ('Inchworm', 'Oruga'),
]
IMPLEMENTS = {  # word -> "con ..." suffix
    'Barbell': 'con barra', 'Dumbbell': 'con mancuerna', 'Dumbbells': 'con mancuernas', 'Two-Dumbbell': 'con dos mancuernas', 'Cable': 'en polea', 'Machine': 'en máquina', 'Kettlebell': 'con kettlebell', 'Kettlebells': 'con kettlebells',
    'Band': 'con banda', 'Bands': 'con bandas', 'Smith': 'en multipower', 'EZ-Bar': 'con barra Z', 'EZ': 'con barra Z', 'Plate': 'con disco', 'Rope': 'con cuerda', 'Sled': 'con trineo', 'Chains': 'con cadenas', 'Chain': 'con cadena', 'Leverage': 'en máquina',
    'Medicine': 'con balón medicinal', 'Ball': '', 'Exercise': 'con fitball', 'Bodyweight': 'con peso corporal', 'Weighted': 'con lastre', 'Suspended': 'en suspensión', 'V-Bar': 'con agarre en V', 'Trap': 'con barra hexagonal', 'Hex': 'con barra hexagonal', 'Landmine': 'en landmine', 'Bosu': 'en bosu', 'Roller': 'con rodillo', 'Foam': '', 'Wheel': 'con rueda', 'Board': 'con tabla', 'Box': 'con cajón', 'Bench': 'en banco', 'Chair': 'en silla', 'Wall': 'en pared', 'Floor': 'en el suelo', 'Towel': 'con toalla', 'Pulley': 'en polea', 'Low-Pulley': 'en polea baja', 'High-Pulley': 'en polea alta', 'Stick': 'con palo', 'Broomstick': 'con palo', 'Blocks': 'desde bloques', 'Rack': 'en rack',
    'Sandbag': 'con saco de arena', 'Keg': 'con barril', 'Tire': 'con neumático', 'Sledgehammer': 'con mazo',
    'Prowler': 'con prowler', 'Yoke': 'con yugo', 'Axle': 'con barra axle', 'Log': 'con log', 'Stone': 'con piedra',
    'Stones': 'con piedras', 'Harness': 'con arnés', 'Straps': 'con correas', 'Ring': 'en anillas', 'Bars': 'en barras',
    'Physioball': 'con fitball', 'Stability': 'con fitball', 'Platform': 'en plataforma', 'Hurdle': 'sobre vallas',
    'Cone': 'con conos', 'Single-Cone': 'con un cono', 'Bag': 'con saco', 'Pin': 'desde pines', 'Pins': 'desde pines',
    'Stairs': 'en escaleras', 'Trail': 'en sendero', 'Air': 'al aire',
}
MODIFIERS = {  # word -> Spanish modifier placed after the noun
    'Incline': 'inclinado', 'Decline': 'declinado', 'Flat': 'plano', 'Seated': 'sentado', 'Standing': 'de pie', 'Lying': 'tumbado', 'Kneeling': 'de rodillas', 'Hanging': 'colgado', 'Prone': 'boca abajo', 'Supine': 'boca arriba', 'Bent-Over': 'inclinado', 'Bent': 'inclinado', 'Over': '', 'Elevated': 'elevado',
    'Reverse': 'inverso', 'Alternating': 'alterno', 'Alternate': 'alterno', 'One-Arm': 'a un brazo', 'Single-Arm': 'a un brazo', 'Two-Arm': 'a dos brazos', 'One-Leg': 'a una pierna', 'Single-Leg': 'a una pierna', 'Single': 'a una pierna', 'Double': 'doble', 'One': 'a un lado', 'Two': 'doble',
    'Wide-Grip': 'agarre ancho', 'Wide': 'ancho', 'Close-Grip': 'agarre cerrado', 'Narrow': 'postura cerrada', 'Medium': 'agarre medio', 'Close': 'cerrado', 'Palms-Up': 'palmas arriba', 'Palms-Down': 'palmas abajo', 'Palms': '', 'Overhead': 'sobre la cabeza', 'Behind': 'por detrás', 'Front': 'frontal', 'Rear': 'trasero', 'Side': 'lateral', 'Lateral': 'lateral', 'Cross': 'cruzado', 'Crossed': 'cruzado', 'Sumo': 'sumo', 'Romanian': 'rumano', 'Bulgarian': 'búlgara', 'Zercher': 'Zercher', 'Jefferson': 'Jefferson', 'Arnold': 'Arnold', 'Bradford': 'Bradford', 'Zottman': 'Zottman', 'Spider': 'araña', 'Drag': 'de arrastre', 'Isometric': 'isométrico', 'Static': 'estático', 'Dynamic': 'dinámico', 'Explosive': 'explosivo', 'Speed': 'de velocidad', 'Power': 'de potencia', 'Hang': 'colgante', 'Deficit': 'con déficit', 'Partial': 'parcial', 'Full': 'completo', 'Half': 'medio', 'Quarter': 'cuarto de', 'Low': 'bajo', 'High': 'alto', 'Upper': 'alto', 'Lower': 'bajo', 'Mid': 'medio', 'Straight-Arm': 'brazos rectos', 'Straight': 'recto', 'Bent-Arm': 'brazos flexionados', 'Stiff-Legged': 'piernas rígidas', 'Stiff': 'rígido', 'Assisted': 'asistido', 'Weighted': 'lastrado', 'Wide-Stance': 'postura ancha', 'Narrow-Stance': 'postura cerrada', 'Stance': '', 'Split': 'dividido', 'Walking': 'caminando', 'Backward': 'hacia atrás', 'Forward': 'hacia adelante', 'Linear': 'lineal', 'Rotational': 'rotacional', 'Internal': 'interna', 'External': 'externa', 'Oblique': 'oblicuo', 'Russian': 'ruso', 'Jump': 'con salto', 'Quick': 'rápido', 'Fast': 'rápido', 'Slow': 'lento', 'Cross-Body': 'cruzado', 'Elbow': 'de codo', 'Elbows': 'de codos', 'Iron': '', 'Atlas': 'Atlas', 'Butt': 'de glúteo', 'Hip': 'de cadera', 'Depth': 'en profundidad', '90': 'a 90 grados', 'Extended': 'extendido', 'Squatting': 'en sentadilla', 'Leaning': 'inclinado', 'Push': 'de empuje', 'Pull': 'de tirón',
    'Lunge': 'en zancada', 'Pike': 'en pica', 'Tuck': 'con rodillas recogidas', 'Tucks': 'con rodillas recogidas',
    'Underhand': 'agarre supino', 'Supinated': 'supino', 'Pronated': 'pronado', 'Neutral': 'neutro',
    'Mixed': 'mixto', 'Vertical': 'vertical', 'Diagonal': 'diagonal', 'Upward': 'ascendente', 'Downward': 'descendente',
    'Anterior': 'anterior', 'Posterior': 'posterior', 'Inner': 'interno', 'Middle': 'medio', 'Parallel': 'paralelo',
    'Heavy': 'pesado', 'Freehand': 'sin peso', 'Manual': 'manual', 'Natural': 'natural', 'Advanced': 'avanzado',
    'Intermediate': 'intermedio', 'Olympic': 'olímpico', 'Powerlifting': 'de powerlifting', 'Plyo': 'pliométrico',
    'Kipping': 'con kipping', 'Scapular': 'escapular', 'Sissy': 'sissy', 'Recumbent': 'reclinado',
    'Side-Lying': 'de lado', 'One-Legged': 'a una pierna', 'Bent-Knee': 'con rodillas dobladas',
    'Rocking': 'con balanceo', 'Moving': 'en movimiento', 'Running': 'corriendo', 'Jogging': 'trotando',
    'Skating': 'de patinador', 'Star': 'estrella', 'Round': 'redondo', 'Open': 'abierto', 'Partials': 'parciales',
    'Seesaw': 'alterno', 'See-Saw': 'alterno', 'Iso': 'isométrico', 'Butterfly': 'mariposa',
    'Straddle': 'con piernas abiertas', 'Scissor': 'en tijera', 'Crucifix': 'en cruz', 'Halo': 'halo',
    'Pyramid': 'en pirámide', 'Series': 'en serie', 'Long': 'largo', 'Above': 'por encima', 'Below': 'por debajo',
    'Apart': 'separadas', 'Across': 'cruzado', 'Around': 'alrededor', 'Through': 'a través',
    'Upright': 'al mentón', 'Concentration': 'concentrado', 'Preacher': 'en banco Scott', 'Cambered': 'curvada',
    'Heaving': 'con impulso', 'Hack': 'hack', 'Dead': 'desde parado', 'Drop': 'en caída', 'Catch': 'con recepción',
    'Pinch': 'con pinza', 'Squeeze': 'con apretón', 'Squeezes': 'con apretón', 'Release': 'con soltada',
    'Release-': 'con soltada', 'Start': 'de inicio', 'Return': 'de vuelta', 'Delivery': 'de entrega',
}
BODY = {  # word -> "de ..." complement
    'Leg': 'de pierna', 'Legs': 'de piernas', 'Arm': 'de brazo', 'Arms': 'de brazos', 'Chest': 'de pecho', 'Shoulder': 'de hombro', 'Shoulders': 'de hombros', 'Back': 'de espalda', 'Neck': 'de cuello', 'Wrist': 'de muñeca', 'Calf': 'de pantorrilla', 'Calves': 'de pantorrillas', 'Hamstring': 'de isquios', 'Hamstrings': 'de isquios', 'Quad': 'de cuádriceps', 'Quads': 'de cuádriceps', 'Glute': 'de glúteo', 'Glutes': 'de glúteos', 'Hip': 'de cadera', 'Hips': 'de cadera', 'Triceps': 'de tríceps', 'Tricep': 'de tríceps', 'Biceps': 'de bíceps', 'Bicep': 'de bíceps', 'Delt': 'de deltoides', 'Deltoid': 'de deltoides', 'Lat': 'dorsal', 'Lats': 'dorsal', 'Trap': 'de trapecio', 'Ab': 'abdominal', 'Abs': 'abdominal', 'Abdominal': 'abdominal', 'Oblique': 'oblicuo', 'Groin': 'de aductores', 'Adductor': 'de aductores', 'Abductor': 'de abductores', 'Ankle': 'de tobillo', 'Knee': 'de rodilla', 'Knees': 'de rodillas', 'Torso': 'de tronco', 'Core': 'de core', 'Head': 'de cabeza', 'Flexor': 'flexor', 'Forearm': 'de antebrazo', 'Toe': 'de puntas', 'Toes': 'de puntas', 'Heel': 'de talón', 'Thigh': 'de muslo', 'Spine': 'de columna', 'Spinal': 'de columna', 'Piriformis': 'del piriforme', 'Pec': 'de pectoral', 'Muscle': '', 'Rotator': 'del manguito rotador', 'Cuff': '',
    'Quadriceps': 'de cuádriceps', 'Soleus': 'del sóleo', 'Gastrocnemius': 'del gemelo', 'Tibialis': 'del tibial',
    'Peroneals': 'de los peroneos', 'Latissimus': 'dorsal', 'Rhomboids': 'de romboides', 'Iliotibial': 'de la banda iliotibial',
    'Achilles': 'del tendón de Aquiles', 'Sternum': 'al esternón', 'Chin': 'de barbilla', 'Finger': 'de dedos',
    'Hand': 'de mano', 'Palm': 'de palma', 'Flexors': 'flexores', 'Ham': 'de isquios', 'Piriformis': 'del piriforme',
    'Brachialis': 'del braquial', 'Rear-Delt': 'de deltoides posterior', 'Calves': 'de pantorrillas',
}
NOISE = {'with', 'With', 'the', 'The', 'a', 'A', 'an', 'An', 'on', 'On', 'to', 'To', 'and', 'And', 'from', 'of', 'Of', 'in', 'In', '-', 'Exercise', 'Version', 'Position', 'Attachment', 'Handle', 'Grip', 'Style', 'Movement', 'Stationary', 'Against', 'Off', 'off', 'Up', 'Ups', 'Down', 'Out', 'In', 'Between', 'Elbows', 'Hands', 'Feet', 'Bar', 'Response)', '(Male', '(Female', 'response)', 'Variation',
    
     
    'Cocoons', 'Groiners', 'Spell', 'Caster', 'Clock', 'Wind', 'Wood', 'Mill',
    'DB', 'SMR', 'IT', 'No', 'At', 'On-Your-Back', 'Your', 'point', 'Para', 'From', 'Into', 'Looking', 'Facing',
    'All', 'Fours', 'Technique',
    'Range', 'Range-Of-Motion', 'Progression', 'Drill', 'Drivers', 'Movers', 'Load', 'Resistance', 'Car',
    'Bottoms', 'Bottoms-Up', 'Back-Leg', 'Leg-Over', 'Leg-Up',
    'Hop-Sprint', 'Acceleration', 'Stride', 'Hug', 'Grab', 'Climb', 'Touches', 'Slides', 'Crosses', 'Sides',
    'Bends', 'Bridges', 'Bridge', 'Drags', 'Adductions', 'Laterals', 'Flyes', 'Pass', 'Fallout', 'Plie', 'Pose',
    'Handed', 'Palm-In', 'Palm-Up', 'Palms-In', '-Pronated', 'Pronation', 'Supination', 'Sit', 'Step', 'Body',
    '3', '4', '3-Part', "180's", ',', 'Jogging,', 'Running,', 'Walking,', 'Ships', 'Calf-Machine', 'Ceiling'}

# Late additions, kept apart so the tables above stay readable. The dataset
# suffixes foam-rolling entries with -SMR, for self-myofascial release.
BODY.update({
    'Dorsi-SMR': 'dorsal con rodillo', 'Tibialis-SMR': 'del tibial con rodillo',
    'Brachialis-SMR': 'del braquial con rodillo', 'Calves-SMR': 'de pantorrillas con rodillo',
    'Foot-SMR': 'del pie con rodillo', 'Hamstring-SMR': 'de isquios con rodillo',
    'Peroneals-SMR': 'de peroneos con rodillo', 'Quadriceps-SMR': 'de cuádriceps con rodillo',
    'Neck-SMR': 'de cuello con rodillo', 'Back-SMR': 'de espalda con rodillo',
    'Rhomboids-SMR': 'de romboides con rodillo', 'Piriformis-SMR': 'del piriforme con rodillo',
    'Tract-SMR': 'de la banda iliotibial con rodillo', 'Adductors-SMR': 'de aductores con rodillo',
    'Quadriceps': 'de cuádriceps', 'Soleus': 'del sóleo', 'Gastrocnemius': 'del gemelo',
    'Tibialis': 'del tibial', 'Peroneals': 'de los peroneos', 'Latissimus': 'dorsal',
    'Rhomboids': 'de romboides', 'Iliotibial': 'de la banda iliotibial', 'Achilles': 'del tendón de Aquiles',
    'Sternum': 'al esternón', 'Chin': 'de barbilla', 'Finger': 'de dedos', 'Hand': 'de mano',
    'Palm': 'de palma', 'Flexors': 'flexores', 'Ham': 'de isquios', 'Piriformis': 'del piriforme',
    'Brachialis': 'del braquial', 'Rear-Delt': 'de deltoides posterior', 'Calves': 'de pantorrillas',
})
MODIFIERS.update({
    'Hammer': 'martillo', 'Face': 'a la cara', 'Bell': 'de campana', 'Scoop': 'de cuchara',
    'Push-off': 'de impulso', 'Inner-Biceps': 'de bíceps interno',
    # Eponyms and nicknames. Spanish speakers say most of these untranslated,
    # so they are kept rather than dropped, which is what made "Cuban Press"
    # come out as a bare "Press".
    'Gironda': 'Gironda', 'Svend': 'Svend', 'Tate': 'Tate', 'JM': 'JM', 'Janda': 'Janda',
    'Otis': 'Otis', "Conan's": 'de Conan', 'Frankenstein': 'Frankenstein', 'Cuban': 'cubano',
    'Judo': 'de judo', 'Carioca': 'carioca', 'Rocky': 'Rocky', 'London': 'London',
    'Monster': 'monster', 'Gorilla': 'de gorila', 'Bear': 'de oso',
    'Locust': 'del saltamontes', 'Cat': 'del gato', 'Donkey': 'de burro', 'Claw': 'de garra',
    'Pirate': 'pirata', 'Circus': 'de circo', 'Rocket': 'cohete', 'Rickshaw': 'rickshaw',
    'Jammer': 'jammer', 'Anti-Gravity': 'antigravedad', 'Guillotine': 'guillotina',
    'Prowler': 'con prowler', "Child's": 'del niño', "Dancer's": 'de bailarina',
    "Runner's": 'de corredor', "World's": 'del mundo', 'Worlds': 'del mundo', 'World': 'del mundo',
    'Greatest': 'mejor', 'Shotgun': 'shotgun',
})

NOUN_INDEX = sorted(NOUNS, key=lambda kv: -len(kv[0]))
NOUN_LOOKUP = dict(NOUNS)

def spanish_name(name):
    """Glossary-based Spanish name. Returns (name, unknown_words)."""
    text = re.sub(r'\s*\(.*?\)\s*', ' ', name).strip()
    text = text.replace(' - ', ' ').replace('/', ' ')
    head = None
    for en, es in NOUN_INDEX:
        pattern = r'(?<![\w-])' + re.escape(en) + r'(?![\w-])'
        if re.search(pattern, text):
            head = es
            text = re.sub(pattern, ' ', text, count=1)
            break
    words = [w for w in text.split() if w]
    mods, comps, impls, unknown = [], [], [], []
    seen = set()
    for w in words:
        key = w if w in IMPLEMENTS or w in MODIFIERS or w in BODY else w.title()
        w = key if key in IMPLEMENTS or key in MODIFIERS or key in BODY else w
        if w in NOISE or w in seen:
            continue
        seen.add(w)
        if w in IMPLEMENTS:
            if IMPLEMENTS[w]: impls.append(IMPLEMENTS[w])
        elif w in MODIFIERS:
            if MODIFIERS[w]: mods.append(MODIFIERS[w])
        elif w in BODY:
            if BODY[w]: comps.append(BODY[w])
        elif w in NOUN_LOOKUP:
            # Already the head of some other entry; keep it in Spanish.
            mods.append(NOUN_LOOKUP[w][:1].lower() + NOUN_LOOKUP[w][1:])
        else:
            unknown.append(w)
    parts = [head] if head else []
    parts += comps + mods + unknown + impls
    deduped = []
    for part in parts:
        if part not in deduped: deduped.append(part)
    out = ' '.join(deduped).strip()
    out = re.sub(r'\s*,\s*', ' ', out)
    out = re.sub(r'\s+', ' ', out).strip()
    return (out[:1].upper() + out[1:]) if out else name, unknown

# --- Import -----------------------------------------------------------------
def load(argv):
    if len(argv) > 1:
        return json.loads(pathlib.Path(argv[1]).read_text())
    with urllib.request.urlopen(SOURCE, timeout=60) as r:
        return json.loads(r.read().decode())

def curated_media_ids():
    return dict((m.group(2), m.group(1)) for m in re.finditer(r"id: '([a-z0-9_]+)'.*?mediaId: '([^']+)'", LIBRARY.read_text()))

def main(argv):
    rows = load(argv)
    curated = curated_media_ids()
    out, steps, unknown_total, flagged = [], {}, {}, 0
    for r in sorted(rows, key=lambda x: x['id']):
        primary = [m for m in r['primaryMuscles'] if m in MUSCLE]
        if not primary:
            continue
        group = MUSCLE[primary[0]]
        secondary = sorted({MUSCLE[m] for m in r['secondaryMuscles'] if m in MUSCLE} - {group})
        type_, purpose = kind(r)
        name_es, unknown = spanish_name(r['name'])
        for w in unknown: unknown_total[w] = unknown_total.get(w, 0) + 1
        row = {
            'id': r['id'],
            'name': r['name'],
            'nameEs': name_es,
            'nameEsReviewed': False,
            'group': group,
            'secondary': secondary,
            'muscles': r['primaryMuscles'],
            'material': MATERIAL.get(r.get('equipment'), 'other'),
            'difficulty': LEVEL[r['level']],
            'type': type_,
            'purpose': purpose,
            'force': r.get('force') or 'static',
            'mechanic': r.get('mechanic'),
            'category': r['category'],
            'images': r.get('images', []),
        }
        if r['id'] in curated:
            row['curated'] = curated[r['id']]
        out.append(row)
        if r.get('instructions'):
            steps[r['id']] = [s.strip() for s in r['instructions'] if s.strip()]
    OUT.write_text(json.dumps(out, ensure_ascii=False, separators=(',', ':')) + '\n')
    OUT_STEPS.write_text(json.dumps(steps, ensure_ascii=False, separators=(',', ':')) + '\n')
    print(f'{len(out)} rows, {len(steps)} with steps, {sum(1 for r in out if "curated" in r)} matched to curated rows')
    print('words left untranslated:', sorted(unknown_total.items(), key=lambda kv: -kv[1])[:60])

if __name__ == '__main__':
    main(sys.argv)
